// k6 load test — simulates the real exam-taking flow at scale.
//
// WHY THIS FILE EXISTS AS A SCRIPT FOR YOU TO RUN, NOT SOMETHING I RAN:
// I don't have your Supabase URL/keys, and running a 1000-VU load test
// against a live production database from an unattended session would be
// genuinely risky (usage costs, possible outage) without you present to
// watch dashboards and abort if something goes wrong. This is the exact
// script — you run it, and I can help interpret the results afterward.
//
// SETUP:
//   1. Install k6: https://k6.io/docs/get-started/installation/
//   2. Create ~1000 real or dedicated TEST student accounts (don't use
//      real students' accounts for this) with a known password pattern,
//      all subscribed to a test category with a test exam scheduled.
//   3. Set the environment variables below.
//   4. Run: k6 run loadtest/exam-flow.js
//
// This ramps up to 1000 virtual users over 2 minutes, holds for 5
// minutes (simulating an exam window), then ramps down — adjust the
// stages below to match your actual exam duration/class size.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const SUPABASE_URL = __ENV.SUPABASE_URL; // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const EXAM_ID = __ENV.EXAM_ID; // the test exam's UUID
const TEST_USER_PREFIX = __ENV.TEST_USER_PREFIX || 'loadtest'; // emails like loadtest1@..., loadtest2@...
const TEST_USER_DOMAIN = __ENV.TEST_USER_DOMAIN || 'example.com';
const TEST_USER_PASSWORD = __ENV.TEST_USER_PASSWORD;

const submitErrors = new Rate('submit_errors');
const submitDuration = new Trend('submit_duration');

export const options = {
  stages: [
    { duration: '2m', target: 1000 }, // ramp-up: students arriving before the exam starts
    { duration: '5m', target: 1000 }, // hold: exam in progress
    { duration: '1m', target: 0 },    // ramp-down
  ],
  thresholds: {
    // Fail the test run if these aren't met — tune to what's actually
    // acceptable for your students, this is a starting point.
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    submit_errors: ['rate<0.01'],      // <1% of submissions fail
  },
};

export default function () {
  const vuId = __VU;
  const email = `${TEST_USER_PREFIX}${vuId}@${TEST_USER_DOMAIN}`;

  // 1) Log in
  const loginRes = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password: TEST_USER_PASSWORD }),
    { headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY } }
  );
  const loginOk = check(loginRes, { 'login succeeded': (r) => r.status === 200 });
  if (!loginOk) { submitErrors.add(1); return; }

  const accessToken = loginRes.json('access_token');
  const authHeaders = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
  };

  // 2) Load the exam's questions (mirrors exam_questions + questions fetch)
  const eqRes = http.get(
    `${SUPABASE_URL}/rest/v1/exam_questions?exam_id=eq.${EXAM_ID}&select=question_id,display_order&order=display_order`,
    { headers: authHeaders }
  );
  check(eqRes, { 'loaded exam questions': (r) => r.status === 200 });
  const questionIds = (eqRes.json() || []).map((r) => r.question_id);
  if (questionIds.length === 0) { submitErrors.add(1); return; }

  const qRes = http.get(
    `${SUPABASE_URL}/rest/v1/questions?id=in.(${questionIds.join(',')})&select=id,correct_option`,
    { headers: authHeaders }
  );
  check(qRes, { 'loaded question bank': (r) => r.status === 200 });
  const questions = qRes.json() || [];

  // Simulate the student actually taking the exam (thinking time).
  sleep(Math.random() * 20 + 10); // 10-30s of "answering"

  // 3) Create the attempt (mirrors LiveExamSession's attempt creation)
  const createRes = http.post(
    `${SUPABASE_URL}/rest/v1/exam_attempts`,
    JSON.stringify({ exam_id: EXAM_ID, attempt_type: 'official', status: 'in_progress' }),
    { headers: { ...authHeaders, Prefer: 'return=representation' } }
  );
  const attempt = (createRes.json() || [])[0];
  if (!attempt) { submitErrors.add(1); return; }

  // 4) Batch-submit all answers in one request (mirrors the real upsert)
  const answerRows = questions.map((q) => ({
    attempt_id: attempt.id,
    question_id: q.id,
    selected_option: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
  }));
  const start = Date.now();
  const submitRes = http.post(
    `${SUPABASE_URL}/rest/v1/attempt_answers`,
    JSON.stringify(answerRows),
    { headers: { ...authHeaders, Prefer: 'resolution=merge-duplicates' } }
  );
  submitDuration.add(Date.now() - start);
  const submitOk = check(submitRes, { 'answers submitted': (r) => r.status === 201 || r.status === 200 });
  submitErrors.add(!submitOk);

  // 5) Finalize (the new server-side authoritative scoring RPC)
  const finalizeRes = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/finalize_exam_attempt`,
    JSON.stringify({ p_attempt_id: attempt.id }),
    { headers: authHeaders }
  );
  check(finalizeRes, { 'finalize succeeded': (r) => r.status === 200 || r.status === 204 });
}

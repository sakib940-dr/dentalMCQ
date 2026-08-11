import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  AdminAnalyticsHeader,
  WeeklyBarPanel,
  AreaLineChartPanel,
  PaymentOverviewPanel,
  SubjectQuestionsPanel,
  lastNDays,
  bucketCountByDay,
  bucketUniqueCountByDay,
  fetchPaymentCounts,
  fetchSubjectDistribution,
} from './AdminAnalyticsWidgets';
import {
  IconUsers,
  IconCreditCard,
  IconActivity,
  IconBookOpen,
  IconPieChart,
} from '../lib/adminIcons';

export default function ModeratorOverview() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [stats, setStats] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [registrationChart, setRegistrationChart] = useState([]);
  const [paymentCounts, setPaymentCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [participationChart, setParticipationChart] = useState([]);
  const [practiceUsersChart, setPracticeUsersChart] = useState([]);
  const [subjectDistribution, setSubjectDistribution] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const days = lastNDays(7);
      const weekStartIso = days[0].toISOString();

      const [
        { count: totalQuestions },
        { count: totalSubjects },
        { count: totalCategories },
        { data: examStatusRows },
        { count: attemptsToday },
        attemptsResult,
        { data: weekAttemptRows },
        { data: weekPracticeSessions },
        // Weekly Registration is Admin-only (moderators don't have a
        // Registrations view) — skip the query entirely for plain
        // moderators instead of fetching data that will never render.
        signupsResult,
        // Payment Overview + subject distribution: EXACT same shared
        // functions the Admin dashboard calls, so the two pages can
        // never disagree on the same metric. Payments stay Admin-only.
        paymentCountsResult,
        subjectDistributionResult,
      ] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('start_time, end_time, is_published'),
        supabase.from('exam_attempts').select('id', { count: 'exact', head: true }).gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('exam_attempts').select('*, profiles(full_name), exams(title)').eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(5),
        // Live/official exam participation — exam_attempts never contains
        // practice sessions (those live in practice_sessions instead).
        supabase.from('exam_attempts').select('started_at').gte('started_at', weekStartIso),
        // Question Bank + Archive Exam practice, deduped to unique users per day below.
        supabase.from('practice_sessions').select('finished_at, examinee_id').gte('finished_at', weekStartIso),
        isAdmin ? supabase.from('profiles').select('created_at').gte('created_at', weekStartIso) : Promise.resolve({ data: [] }),
        isAdmin ? fetchPaymentCounts(supabase) : Promise.resolve({ pending: 0, approved: 0, rejected: 0 }),
        fetchSubjectDistribution(supabase),
      ]);

      if (cancelled) return;

      const now = new Date();
      let live = 0, upcoming = 0, archived = 0;
      (examStatusRows || []).forEach((e) => {
        if (!e.is_published) return;
        const start = new Date(e.start_time), end = new Date(e.end_time);
        if (now < start) upcoming++;
        else if (now <= end) live++;
        else archived++;
      });

      setStats({
        totalQuestions: totalQuestions || 0,
        totalSubjects: totalSubjects || 0,
        totalCategories: totalCategories || 0,
        totalExams: (examStatusRows || []).length,
        live, upcoming, archived,
        attemptsToday: attemptsToday || 0,
        pendingClaims: paymentCountsResult.pending,
      });
      setRecentAttempts(attemptsResult.data || []);

      if (isAdmin) {
        setRegistrationChart(bucketCountByDay(signupsResult.data, 'created_at', days));
        setPaymentCounts(paymentCountsResult);
      }
      setParticipationChart(bucketCountByDay(weekAttemptRows, 'started_at', days));
      setPracticeUsersChart(bucketUniqueCountByDay(weekPracticeSessions, 'finished_at', 'examinee_id', days));
      setSubjectDistribution(subjectDistributionResult);
    }

    load();
    return () => { cancelled = true; };
  }, [isAdmin]);

  if (!stats) return <div className="panel"><p className="muted">Loading overview…</p></div>;

  const heading = isAdmin ? 'Admin Analytics' : 'Moderator Overview';
  const subheading = isAdmin
    ? 'Platform activity at a glance'
    : 'A snapshot of the question bank and exams you help manage.';

  return (
    <>
      <AdminAnalyticsHeader title={heading} subtitle={subheading} />

      {/* Weekly Registration — Admin only, absent for plain moderators */}
      {isAdmin && (
        <WeeklyBarPanel
          icon={<IconUsers size={17} />}
          title="Weekly Registration"
          subtitle="New sign-ups over the last 7 days"
          data={registrationChart}
          color="var(--blue)"
          colorDeep="#1F4E75"
          emptyLabel="No new sign-ups this week."
        />
      )}

      {/* Payment Overview — Admin only, absent for plain moderators */}
      {isAdmin && <PaymentOverviewPanel icon={<IconCreditCard size={17} />} {...paymentCounts} />}

      <AreaLineChartPanel
        icon={<IconActivity size={17} />}
        title="Live Exam Participation"
        subtitle="Official exam attempts per day — last 7 days"
        days={participationChart}
        color="var(--teal)"
        gradientId="moderatorParticipationGrad"
        emptyLabel="No exam attempts yet this week."
      />

      <WeeklyBarPanel
        icon={<IconBookOpen size={17} />}
        title="Unique Practice Users"
        subtitle="Distinct users who practiced each day — last 7 days"
        data={practiceUsersChart}
        color="var(--gold)"
        colorDeep="#8A6A2E"
        emptyLabel="No practice activity yet this week."
      />

      <SubjectQuestionsPanel icon={<IconPieChart size={17} />} subjects={subjectDistribution} />

      {/* Quick actions intentionally omitted here — Exam Create, Question
          Add, and Notice all already live in the bottom navigation (and
          Categories/Settings/Payments live in the side drawer), so
          repeating them as buttons on the dashboard would just duplicate
          existing navigation. */}

      <div className="panel">
        <h2>Recent exam submissions</h2>
        <div className="recent-list">
          {recentAttempts.length === 0 && <div className="muted small">No submissions yet.</div>}
          {recentAttempts.map((a) => (
            <div key={a.id} className="recent-row">
              <div>
                <span className="recent-name">{a.profiles?.full_name || 'Student'}</span>
                <span className="muted small"> · {a.exams?.title || 'Deleted exam'}</span>
              </div>
              <span className="muted small">{a.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

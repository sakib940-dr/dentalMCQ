import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  IconHelpCircle,
  IconBookOpen,
  IconFolderTree,
  IconFileText,
  IconTarget,
  IconArchive,
  IconAlertTriangle,
} from '../lib/adminIcons';

function StatCard({ icon, label, value, sub, accent = 'var(--teal)' }) {
  return (
    <div className="analytics-stat-card" style={{ '--stat-accent': accent }}>
      <div className="analytics-stat-icon">{icon}</div>
      <div className="analytics-stat-value">{value}</div>
      <div className="analytics-stat-label">{label}</div>
      {sub && <div className="analytics-stat-sub">{sub}</div>}
    </div>
  );
}

function BarChart({ data, color = 'var(--teal)', colorDeep = 'var(--teal-deep)' }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="analytics-bar-chart">
      {data.map((d, i) => (
        <div key={i} className="analytics-bar-col">
          <div className="analytics-bar-wrap">
            <div
              className="analytics-bar"
              style={{ height: `${(d.count / max) * 100}%`, '--bar-color': color, '--bar-color-deep': colorDeep }}
            />
          </div>
          <div className="analytics-bar-value">{d.count}</div>
          <div className="analytics-bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function CompareBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="analytics-compare">
      {rows.map((r) => (
        <div key={r.label} className="analytics-compare-row">
          <span className="analytics-compare-label">{r.label}</span>
          <div className="analytics-compare-track">
            <div
              className="analytics-compare-fill"
              style={{ width: `${(r.count / max) * 100}%`, '--fill-color': r.color }}
            />
          </div>
          <span className="analytics-compare-value">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

// Buckets a list of rows (each with a date field) into the last N
// calendar days, oldest first — used by every chart below so they all
// read the same week the same way.
function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function bucketByDay(rows, dateField, days) {
  return days.map((d) => {
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const count = rows.filter((r) => r[dateField] && new Date(r[dateField]).toDateString() === d.toDateString()).length;
    return { label, count };
  });
}

export default function ModeratorOverview() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [stats, setStats] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [attention, setAttention] = useState([]);
  const [registrationChart, setRegistrationChart] = useState([]);
  const [participationChart, setParticipationChart] = useState([]);
  const [qbWeeklyChart, setQbWeeklyChart] = useState([]);
  const [practiceComparison, setPracticeComparison] = useState([]);

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
        subjectsResult,
        { data: recentSignups },
        { data: recentAttemptRows },
        { data: recentPracticeSessions },
      ] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('start_time, end_time, is_published'),
        supabase.from('exam_attempts').select('id', { count: 'exact', head: true }).gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('exam_attempts').select('*, profiles(full_name), exams(title)').eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(5),
        supabase.from('subjects').select('id, name, category_id'),
        // Existing data only — same "profiles.created_at" signal already
        // used by the Super Admin overview's sign-up chart.
        supabase.from('profiles').select('created_at').gte('created_at', weekStartIso),
        // Live/official exam participation — exam_attempts never contains
        // practice sessions (those live in practice_sessions instead).
        supabase.from('exam_attempts').select('started_at').gte('started_at', weekStartIso),
        // Question Bank practice has source_exam_id = null; retaking an
        // archived exam sets source_exam_id, per the existing app convention.
        supabase.from('practice_sessions').select('finished_at, source_exam_id').gte('finished_at', weekStartIso),
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
      });
      setRecentAttempts(attemptsResult.data || []);

      setRegistrationChart(bucketByDay(recentSignups || [], 'created_at', days));
      setParticipationChart(bucketByDay(recentAttemptRows || [], 'started_at', days));

      const qbSessions = (recentPracticeSessions || []).filter((s) => !s.source_exam_id);
      const archiveSessions = (recentPracticeSessions || []).filter((s) => s.source_exam_id);
      setQbWeeklyChart(bucketByDay(qbSessions, 'finished_at', days));
      setPracticeComparison([
        { label: 'Question Bank', count: qbSessions.length, color: 'var(--teal)' },
        { label: 'Archive Exam', count: archiveSessions.length, color: 'var(--gold)' },
      ]);

      // Same bulk-query rewrite as SuperAdminOverview — avoids up to 90
      // sequential round-trips for up to 30 subjects.
      const subjectsToCheck = (subjectsResult.data || []).slice(0, 30);
      const subjectIds = subjectsToCheck.map((s) => s.id);

      const { data: allSubcats } = subjectIds.length
        ? await supabase.from('subcategories').select('id, subject_id').in('subject_id', subjectIds)
        : { data: [] };
      const subcatIds = (allSubcats || []).map((sc) => sc.id);
      const subcatToSubject = new Map((allSubcats || []).map((sc) => [sc.id, sc.subject_id]));

      const { data: allChapters } = subcatIds.length
        ? await supabase.from('chapters').select('id, subcategory_id').in('subcategory_id', subcatIds)
        : { data: [] };
      const chapterToSubject = new Map(
        (allChapters || []).map((ch) => [ch.id, subcatToSubject.get(ch.subcategory_id)])
      );
      const allChapterIds = (allChapters || []).map((ch) => ch.id);

      const { data: allQuestions } = allChapterIds.length
        ? await supabase.from('questions').select('chapter_id').in('chapter_id', allChapterIds).eq('is_active', true)
        : { data: [] };

      const questionCountBySubject = new Map();
      (allQuestions || []).forEach((q) => {
        const subjId = chapterToSubject.get(q.chapter_id);
        if (subjId) questionCountBySubject.set(subjId, (questionCountBySubject.get(subjId) || 0) + 1);
      });

      const subjectAttention = [];
      for (const s of subjectsToCheck) {
        const hasAnySubcat = (allSubcats || []).some((sc) => sc.subject_id === s.id);
        if (!hasAnySubcat) {
          subjectAttention.push({ name: s.name, reason: 'No chapters set up yet' });
          continue;
        }
        const count = questionCountBySubject.get(s.id) || 0;
        if (count < 5) {
          subjectAttention.push({ name: s.name, reason: `Only ${count} question${count === 1 ? '' : 's'}` });
        }
      }
      if (cancelled) return;
      setAttention(subjectAttention.slice(0, 5));
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!stats) return <div className="panel"><p className="muted">Loading overview…</p></div>;

  const heading = isAdmin ? 'Analytics' : 'Moderator Overview';
  const subheading = isAdmin
    ? 'A live snapshot of platform activity — exams, question bank & practice trends.'
    : 'A snapshot of the question bank and exams you help manage.';

  return (
    <>
      <div className="panel">
        <h2>{heading}</h2>
        <p className="muted small">{subheading}</p>

        <div className="analytics-stat-grid">
          <StatCard icon={<IconHelpCircle size={20} />} label="Questions" value={stats.totalQuestions} accent="var(--teal)" />
          <StatCard icon={<IconBookOpen size={20} />} label="Subjects" value={stats.totalSubjects} accent="var(--gold)" />
          <StatCard icon={<IconFolderTree size={20} />} label="Categories" value={stats.totalCategories} accent="var(--blue)" />
          <StatCard icon={<IconFileText size={20} />} label="Total Exams" value={stats.totalExams} sub={`${stats.live} live · ${stats.upcoming} upcoming`} accent="var(--purple)" />
          <StatCard icon={<IconTarget size={20} />} label="Attempts Today" value={stats.attemptsToday} accent="var(--green)" />
          <StatCard icon={<IconArchive size={20} />} label="Archived Exams" value={stats.archived} accent="var(--red)" />
        </div>
      </div>

      <div className="panel analytics-chart-panel">
        <h2>Weekly Registration</h2>
        <p className="muted small analytics-chart-sub">New sign-ups over the last 7 days.</p>
        <BarChart data={registrationChart} color="var(--blue)" colorDeep="var(--teal-deep)" />
      </div>

      <div className="panel analytics-chart-panel">
        <h2>Live Exam Participation</h2>
        <p className="muted small analytics-chart-sub">Official exam attempts over the last 7 days.</p>
        <BarChart data={participationChart} color="var(--teal)" colorDeep="var(--teal-deep)" />
      </div>

      <div className="panel analytics-chart-panel">
        <h2>Question Bank vs Archive Exam Practice</h2>
        <p className="muted small analytics-chart-sub">Practice sessions in the last 7 days, by type.</p>
        <CompareBars rows={practiceComparison} />
      </div>

      <div className="panel analytics-chart-panel">
        <h2>Weekly Question Bank Practice</h2>
        <p className="muted small analytics-chart-sub">Question Bank practice sessions over the last 7 days.</p>
        <BarChart data={qbWeeklyChart} color="var(--gold)" colorDeep="#8A6A2E" />
      </div>

      <div className="panel">
        <h2>Quick actions</h2>
        <div className="quick-actions-row">
          <button className="btn-primary" onClick={() => navigate('/moderator/exams')}>+ New Exam</button>
          {isAdmin && <button className="btn-secondary" onClick={() => navigate('/moderator/categories')}>+ New Category</button>}
          <button className="btn-secondary" onClick={() => navigate('/moderator/questions')}>+ Add Questions</button>
          <button className="btn-secondary" onClick={() => navigate('/moderator/notices')}>+ Post Notice</button>
        </div>
      </div>

      {attention.length > 0 && (
        <div className="panel">
          <h2>Needs attention</h2>
          <div className="attention-list">
            {attention.map((a, i) => (
              <div key={i} className="attention-row">
                <span className="attention-icon"><IconAlertTriangle size={16} /></span>
                <div>
                  <div className="attention-name">{a.name}</div>
                  <div className="muted small">{a.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

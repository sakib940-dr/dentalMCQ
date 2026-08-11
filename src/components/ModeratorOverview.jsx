import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import {
  AdminAnalyticsHeader,
  WeeklyBarPanel,
  AreaLineChartPanel,
  PaymentOverviewPanel,
  SubjectQuestionsPanel,
  NeedsAttentionPanel,
  lastNDays,
  bucketCountByDay,
  bucketUniqueCountByDay,
} from './AdminAnalyticsWidgets';
import {
  IconHelpCircle,
  IconBookOpen,
  IconFolderTree,
  IconFileText,
  IconTarget,
  IconArchive,
  IconUsers,
  IconCreditCard,
  IconActivity,
  IconPieChart,
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

export default function ModeratorOverview() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [stats, setStats] = useState(null);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [attention, setAttention] = useState([]);
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
        subjectsResult,
        { data: weekAttemptRows },
        { data: weekPracticeSessions },
        // Weekly Registration & Payment Overview are Admin-only sections
        // (moderators don't have a Payments page/route) — skip the
        // queries entirely for plain moderators instead of fetching data
        // that will never render.
        signupsResult,
        pendingResult,
        approvedResult,
        rejectedResult,
      ] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('start_time, end_time, is_published'),
        supabase.from('exam_attempts').select('id', { count: 'exact', head: true }).gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('exam_attempts').select('*, profiles(full_name), exams(title)').eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(5),
        supabase.from('subjects').select('id, name, category_id'),
        // Live/official exam participation — exam_attempts never contains
        // practice sessions (those live in practice_sessions instead).
        supabase.from('exam_attempts').select('started_at').gte('started_at', weekStartIso),
        // Question Bank + Archive Exam practice, deduped to unique users per day below.
        supabase.from('practice_sessions').select('finished_at, examinee_id').gte('finished_at', weekStartIso),
        isAdmin ? supabase.from('profiles').select('created_at').gte('created_at', weekStartIso) : Promise.resolve({ data: [] }),
        isAdmin ? supabase.from('payment_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending') : Promise.resolve({ count: 0 }),
        isAdmin ? supabase.from('payment_claims').select('id', { count: 'exact', head: true }).eq('status', 'approved') : Promise.resolve({ count: 0 }),
        isAdmin ? supabase.from('payment_claims').select('id', { count: 'exact', head: true }).eq('status', 'rejected') : Promise.resolve({ count: 0 }),
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
        pendingClaims: pendingResult.count || 0,
      });
      setRecentAttempts(attemptsResult.data || []);

      if (isAdmin) {
        setRegistrationChart(bucketCountByDay(signupsResult.data, 'created_at', days));
        setPaymentCounts({ pending: pendingResult.count || 0, approved: approvedResult.count || 0, rejected: rejectedResult.count || 0 });
      }
      setParticipationChart(bucketCountByDay(weekAttemptRows, 'started_at', days));
      setPracticeUsersChart(bucketUniqueCountByDay(weekPracticeSessions, 'finished_at', 'examinee_id', days));

      // Same bulk-query rewrite as SuperAdminOverview — avoids up to 90
      // sequential round-trips for up to 30 subjects. Also reused for the
      // Subject-wise Question Count donut.
      const subjectsToCheck = (subjectsResult.data || []).slice(0, 60);
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

      const distribution = subjectsToCheck
        .map((s) => ({ id: s.id, name: s.name, count: questionCountBySubject.get(s.id) || 0 }))
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count);
      if (cancelled) return;
      setSubjectDistribution(distribution);

      // ---------- Needs attention: only real, currently-true conditions ----------
      const attentionItems = [];
      if (isAdmin && (pendingResult.count || 0) > 0) {
        attentionItems.push({
          name: 'Pending payments',
          reason: `${pendingResult.count} payment claim${pendingResult.count === 1 ? '' : 's'} awaiting review`,
          onClick: () => navigate('/moderator/payments'),
        });
      }
      subjectsToCheck.forEach((s) => {
        const hasAnySubcat = (allSubcats || []).some((sc) => sc.subject_id === s.id);
        if (!hasAnySubcat) {
          attentionItems.push({ name: s.name, reason: 'No chapters set up yet' });
          return;
        }
        const count = questionCountBySubject.get(s.id) || 0;
        if (count < 5) {
          attentionItems.push({ name: s.name, reason: `Only ${count} question${count === 1 ? '' : 's'}` });
        }
      });
      if (cancelled) return;
      setAttention(attentionItems.slice(0, 6));
    }

    load();
    return () => { cancelled = true; };
  }, [isAdmin, navigate]);

  if (!stats) return <div className="panel"><p className="muted">Loading overview…</p></div>;

  const heading = isAdmin ? 'Admin Analytics' : 'Moderator Overview';
  const subheading = isAdmin
    ? 'Platform activity at a glance'
    : 'A snapshot of the question bank and exams you help manage.';

  return (
    <>
      <AdminAnalyticsHeader title={heading} subtitle={subheading} />

      <div className="panel">
        <div className="analytics-stat-grid">
          <StatCard icon={<IconHelpCircle size={18} />} label="Questions" value={stats.totalQuestions} accent="var(--teal)" />
          <StatCard icon={<IconBookOpen size={18} />} label="Subjects" value={stats.totalSubjects} accent="var(--gold)" />
          <StatCard icon={<IconFolderTree size={18} />} label="Categories" value={stats.totalCategories} accent="var(--blue)" />
          <StatCard icon={<IconFileText size={18} />} label="Total Exams" value={stats.totalExams} sub={`${stats.live} live · ${stats.upcoming} upcoming`} accent="var(--purple)" />
          <StatCard icon={<IconTarget size={18} />} label="Attempts Today" value={stats.attemptsToday} accent="var(--green)" />
          <StatCard icon={<IconArchive size={18} />} label="Archived Exams" value={stats.archived} accent="var(--red)" />
        </div>
      </div>

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

      <div className="panel">
        <h2>Quick actions</h2>
        <div className="quick-actions-row">
          <button className="btn-primary" onClick={() => navigate('/moderator/exams')}>+ New Exam</button>
          {isAdmin && <button className="btn-secondary" onClick={() => navigate('/moderator/categories')}>+ New Category</button>}
          <button className="btn-secondary" onClick={() => navigate('/moderator/questions')}>+ Add Questions</button>
          <button className="btn-secondary" onClick={() => navigate('/moderator/notices')}>+ Post Notice</button>
        </div>
      </div>

      <NeedsAttentionPanel items={attention} />

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

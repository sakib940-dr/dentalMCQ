import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { fmtDateTime } from '../lib/formatters';
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
  IconUsers,
  IconCreditCard,
  IconActivity,
  IconBookOpen,
  IconPieChart,
  IconHelpCircle,
  IconFolderTree,
  IconFileText,
  IconTarget,
  IconArchive,
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

export default function SuperAdminOverview() {
  const navigate = useNavigate();

  // Preserved platform-wide counters (unchanged data/queries), shown in a
  // compact stat strip rather than the old oversized 2-column grid.
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [topExams, setTopExams] = useState([]);
  const [topPrescribers, setTopPrescribers] = useState([]);

  // New analytics sequence (real data only).
  const [registrationChart, setRegistrationChart] = useState([]);
  const [paymentCounts, setPaymentCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [participationChart, setParticipationChart] = useState([]);
  const [practiceUsersChart, setPracticeUsersChart] = useState([]);
  const [subjectDistribution, setSubjectDistribution] = useState([]);
  const [attention, setAttention] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const days = lastNDays(7);
      const weekStartIso = days[0].toISOString();

      const [
        { count: totalQuestions },
        { count: totalStudents },
        { count: totalModerators },
        { count: totalSubjects },
        { count: totalCategories },
        { data: examStatusRows },
        { count: attemptsToday },
        usersResult,
        attemptsResult,
        subjectsResult,
        { count: pendingClaims },
        { count: approvedClaims },
        { count: rejectedClaims },
        { count: activeSubscriptions },
        revenueResult,
        { count: totalPrescriptions },
        topPrescribersResult,
        { data: recentSignups },
        { data: weekAttemptRows },
        { data: weekPracticeSessions },
        { count: newFeedbackCount },
        { data: stuckAttempts },
      ] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'examinee'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'moderator'),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('start_time, end_time, is_published'),
        supabase.from('exam_attempts').select('id', { count: 'exact', head: true }).gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('exam_attempts').select('*, profiles(full_name), exams(title)').eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(5),
        supabase.from('subjects').select('id, name, category_id'),
        supabase.from('payment_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payment_claims').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('payment_claims').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('category_access_grants').select('id', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString()),
        supabase.from('payment_claims').select('final_amount').eq('status', 'approved').neq('method', 'discount_claim'),
        supabase.from('prescriptions').select('id', { count: 'exact', head: true }),
        supabase.from('prescription_usage_summary').select('*').limit(5),
        // ---- New analytics: real rows for the last 7 days ----
        supabase.from('profiles').select('created_at').gte('created_at', weekStartIso),
        supabase.from('exam_attempts').select('started_at').gte('started_at', weekStartIso),
        supabase.from('practice_sessions').select('finished_at, examinee_id').gte('finished_at', weekStartIso),
        supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('stuck_exam_attempts').select('*'),
      ]);

      if (cancelled) return;

      // Live/upcoming/archived breakdown computed from time, same rule as the rest of the app
      const now = new Date();
      let live = 0, upcoming = 0, archived = 0, draft = 0;
      (examStatusRows || []).forEach((e) => {
        if (!e.is_published) { draft++; return; }
        const start = new Date(e.start_time), end = new Date(e.end_time);
        if (now < start) upcoming++;
        else if (now <= end) live++;
        else archived++;
      });

      const totalRevenue = (revenueResult.data || []).reduce((sum, r) => sum + (r.final_amount || 0), 0);

      setStats({
        totalQuestions: totalQuestions || 0,
        totalStudents: totalStudents || 0,
        totalModerators: totalModerators || 0,
        totalSubjects: totalSubjects || 0,
        totalCategories: totalCategories || 0,
        totalExams: (examStatusRows || []).length,
        live, upcoming, archived, draft,
        attemptsToday: attemptsToday || 0,
        pendingClaims: pendingClaims || 0,
        activeSubscriptions: activeSubscriptions || 0,
        totalRevenue,
        totalPrescriptions: totalPrescriptions || 0,
      });
      setTopPrescribers(topPrescribersResult.data || []);
      setRecentUsers(usersResult.data || []);
      setRecentAttempts(attemptsResult.data || []);

      setPaymentCounts({ pending: pendingClaims || 0, approved: approvedClaims || 0, rejected: rejectedClaims || 0 });
      setRegistrationChart(bucketCountByDay(recentSignups, 'created_at', days));
      setParticipationChart(bucketCountByDay(weekAttemptRows, 'started_at', days));
      setPracticeUsersChart(bucketUniqueCountByDay(weekPracticeSessions, 'finished_at', 'examinee_id', days));

      // Subject hierarchy -> question counts, computed once with 3 bulk
      // queries total (instead of a per-subject loop) and reused for both
      // the Subject-wise Question Count donut and the low-content
      // "Needs attention" check below.
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
      if ((pendingClaims || 0) > 0) {
        attentionItems.push({
          name: 'Pending payments',
          reason: `${pendingClaims} payment claim${pendingClaims === 1 ? '' : 's'} awaiting review`,
          onClick: () => navigate('/admin/payments'),
        });
      }
      if ((newFeedbackCount || 0) > 0) {
        attentionItems.push({
          name: 'Unresolved feedback',
          reason: `${newFeedbackCount} new feedback entr${newFeedbackCount === 1 ? 'y' : 'ies'} to review`,
          onClick: () => navigate('/admin/feedback'),
        });
      }
      if ((stuckAttempts || []).length > 0) {
        const n = stuckAttempts.length;
        attentionItems.push({
          name: 'Stuck exam attempts',
          reason: `${n} attempt${n === 1 ? '' : 's'} never got submitted`,
          onClick: () => navigate('/admin/access'),
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

      // Top exams by attempt count (preserved)
      const { data: allAttempts } = await supabase.from('exam_attempts').select('exam_id, exams(title)').eq('status', 'submitted');
      if (cancelled) return;
      const tally = {};
      (allAttempts || []).forEach((a) => {
        const title = a.exams?.title || 'Unknown';
        tally[title] = (tally[title] || 0) + 1;
      });
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, count]) => ({ title, count }));
      setTopExams(top);
    }

    load();
    return () => { cancelled = true; };
  }, [navigate]);

  if (!stats) return <div className="panel"><p className="muted">Loading overview…</p></div>;

  return (
    <>
      {/* 1. Header */}
      <AdminAnalyticsHeader title="Admin Analytics" subtitle="Platform activity at a glance" />

      {/* Preserved platform counters — compact stat strip, not the old large grid */}
      <div className="panel">
        <div className="analytics-stat-grid">
          <StatCard icon={<IconHelpCircle size={18} />} label="Questions" value={stats.totalQuestions} accent="var(--teal)" />
          <StatCard icon={<IconUsers size={18} />} label="Students" value={stats.totalStudents} accent="var(--blue)" />
          <StatCard icon={<IconFolderTree size={18} />} label="Categories" value={stats.totalCategories} accent="var(--purple)" />
          <StatCard icon={<IconFileText size={18} />} label="Total Exams" value={stats.totalExams} sub={`${stats.live} live · ${stats.upcoming} upcoming`} accent="var(--gold)" />
          <StatCard icon={<IconTarget size={18} />} label="Attempts Today" value={stats.attemptsToday} accent="var(--green)" />
          <StatCard icon={<IconArchive size={18} />} label="Archived Exams" value={stats.archived} accent="var(--red)" />
        </div>
      </div>

      {/* 2. Weekly Registered Users */}
      <WeeklyBarPanel
        icon={<IconUsers size={17} />}
        title="Weekly Registration"
        subtitle="New sign-ups over the last 7 days"
        data={registrationChart}
        color="var(--blue)"
        colorDeep="#1F4E75"
        emptyLabel="No new sign-ups this week."
      />

      {/* 3. Payment Status Analytics */}
      <PaymentOverviewPanel icon={<IconCreditCard size={17} />} {...paymentCounts} />

      {/* 4. Weekly Live Exam Participation */}
      <AreaLineChartPanel
        icon={<IconActivity size={17} />}
        title="Live Exam Participation"
        subtitle="Official exam attempts per day — last 7 days"
        days={participationChart}
        color="var(--teal)"
        gradientId="superAdminParticipationGrad"
        emptyLabel="No exam attempts yet this week."
      />

      {/* 5. Weekly Practice Mode Usage (unique users) */}
      <WeeklyBarPanel
        icon={<IconBookOpen size={17} />}
        title="Unique Practice Users"
        subtitle="Distinct users who practiced each day — last 7 days"
        data={practiceUsersChart}
        color="var(--gold)"
        colorDeep="#8A6A2E"
        emptyLabel="No practice activity yet this week."
      />

      {/* 6. Subject-wise Question Count */}
      <SubjectQuestionsPanel icon={<IconPieChart size={17} />} subjects={subjectDistribution} />

      {/* 7. Needs attention (real conditions only) */}
      <NeedsAttentionPanel items={attention} />

      <div className="panel">
        <h2>Quick actions</h2>
        <div className="quick-actions-row">
          <button className="btn-primary" onClick={() => navigate('/admin/exams')}>+ New Exam</button>
          <button className="btn-secondary" onClick={() => navigate('/admin/categories')}>+ New Category</button>
          <button className="btn-secondary" onClick={() => navigate('/admin/questions')}>+ Add Questions</button>
          <button className="btn-secondary" onClick={() => navigate('/admin/notices')}>+ Post Notice</button>
          {stats.pendingClaims > 0 && (
            <button className="btn-primary" onClick={() => navigate('/admin/payments')}>
              Review {stats.pendingClaims} Pending Payment{stats.pendingClaims !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Recent registrations</h2>
        <div className="recent-list">
          {recentUsers.length === 0 && <div className="muted small">No users yet.</div>}
          {recentUsers.map((u) => (
            <div key={u.id} className="recent-row">
              <div>
                <span className="recent-name">{u.full_name}</span>
                <span className={`role-badge role-badge-${u.role}`} style={{ marginLeft: 8 }}>{u.role}</span>
              </div>
              <span className="muted small">{fmtDateTime(u.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

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

      {topExams.length > 0 && (
        <div className="panel">
          <h2>Most attempted exams</h2>
          <div className="recent-list">
            {topExams.map((e, i) => (
              <div key={i} className="recent-row">
                <span className="recent-name">{e.title}</span>
                <span className="muted small">{e.count} attempt{e.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topPrescribers.length > 0 && (
        <div className="panel">
          <h2>Top Prescription Generators</h2>
          <div className="recent-list">
            {topPrescribers.map((p) => (
              <div key={p.user_id} className="recent-row">
                <div>
                  <span className="recent-name">{p.full_name}</span>
                  <span className={`role-badge role-badge-${p.role}`} style={{ marginLeft: 6 }}>{p.role}</span>
                </div>
                <span className="muted small">{p.total_prescriptions} prescription{p.total_prescriptions !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
          <button className="btn-secondary" onClick={() => navigate('/admin/prescriptions')} style={{ marginTop: 10 }}>
            View all prescription activity
          </button>
        </div>
      )}
    </>
  );
}

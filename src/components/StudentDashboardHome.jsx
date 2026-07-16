import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { daysLeft, timeAgo } from '../lib/formatters';

// ============================================================
// Quick actions — the primary "do something" entry points.
// Chamber Management is listed but disabled: the module doesn't exist
// yet, and a tile that silently goes nowhere would be worse than one
// that's honestly marked "Coming soon".
// ============================================================
function QuickActionsGrid() {
  const navigate = useNavigate();

  const actions = [
    { icon: '📖', label: 'Question Bank Practice', onClick: () => navigate('/dashboard/question-bank') },
    { icon: '🎯', label: 'Start Mock Exam', onClick: () => navigate('/dashboard/exams') },
    { icon: '🔁', label: 'Wrong Answer Revision', onClick: () => navigate('/dashboard/practice-session', { state: { session: { mode: 'wrong' } } }) },
    { icon: '❤️', label: 'Bookmarked Questions', onClick: () => navigate('/dashboard/bookmarks') },
    { icon: '📋', label: 'Prescription Tool', onClick: () => navigate('/dashboard/prescription') },
    { icon: '🏥', label: 'Dental Chamber', onClick: () => navigate('/dashboard/chamber') },
  ];

  return (
    <div className="panel">
      <h2>Quick Actions</h2>
      <div className="quick-action-grid">
        {actions.map((a) => (
          <button
            key={a.label}
            className={a.soon ? 'quick-action-tile quick-action-tile-soon' : 'quick-action-tile'}
            onClick={a.onClick || undefined}
            disabled={a.soon}
          >
            <span className="quick-action-tile-icon">{a.icon}</span>
            <span className="quick-action-tile-label">{a.label}</span>
            {a.soon && <span className="quick-action-tile-badge">Soon</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Subscription summary — a compact status strip, not a rebuild of
// PackagePage. Shows the grant closest to expiring; "Manage" opens the
// full package page for anything more detailed.
// ============================================================
function SubscriptionStrip({ grants, categories }) {
  const navigate = useNavigate();
  const now = new Date();
  const active = grants
    .filter((g) => !g.expires_at || new Date(g.expires_at) > now)
    .sort((a, b) => {
      if (!a.expires_at) return 1;
      if (!b.expires_at) return -1;
      return new Date(a.expires_at) - new Date(b.expires_at);
    });

  if (active.length === 0) {
    return (
      <div className="panel subscription-strip subscription-strip-empty">
        <div>
          <div className="subscription-strip-title">No active subscription</div>
          <div className="subscription-strip-sub">Subscribe to a category to unlock its exams and practice.</div>
        </div>
        <button className="btn-primary sm" onClick={() => navigate('/dashboard/package')}>Browse Packages</button>
      </div>
    );
  }

  const soonest = active[0];
  const remaining = daysLeft(soonest.expires_at);
  const name = soonest.resource_type === 'prescription' ? 'Prescription' : (categories.find((c) => c.id === soonest.category_id)?.name || 'Category');

  return (
    <div className="panel subscription-strip">
      <div>
        <div className="subscription-strip-title">
          {active.length > 1 ? `${active.length} active subscriptions` : name}
        </div>
        <div className="subscription-strip-sub">
          {active.length > 1 ? `Next to expire: ${name}` : 'Current Package'}
          {remaining !== null ? ` · ${remaining} day${remaining !== 1 ? 's' : ''} left` : ' · No expiry'}
        </div>
      </div>
      <button className="btn-secondary sm" onClick={() => navigate('/dashboard/package')}>Renew / Manage</button>
    </div>
  );
}

// ============================================================
// Exam overview stat cards
// ============================================================
function StatCard({ label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={onClick ? 'stat-card stat-card-tappable' : 'stat-card'} onClick={onClick}>
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </Tag>
  );
}

// ============================================================
// Root
// ============================================================
export default function StudentDashboardHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [grants, setGrants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [
        grantsResult,
        categoriesResult,
        officialAttemptedResult,
        officialCorrectResult,
        officialWrongResult,
        practiceAttemptedResult,
        practiceCorrectResult,
        practiceWrongResult,
        examAttemptsResult,
        practiceSessionsResult,
        wrongCountResult,
        bookmarkCountResult,
      ] = await Promise.all([
        supabase.from('category_access_grants').select('*').eq('examinee_id', user.id),
        supabase.from('categories').select('id, name'),
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).not('selected_option', 'is', null),
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).eq('is_correct', true),
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).eq('is_correct', false),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).not('selected_option', 'is', null),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).eq('is_correct', true),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).eq('is_correct', false),
        supabase.from('exam_attempts').select('id, percentage, submitted_at, exams(title, end_time)').eq('examinee_id', user.id).eq('attempt_type', 'official').eq('status', 'submitted').order('submitted_at', { ascending: false }),
        supabase.from('practice_sessions').select('id, finished_at, correct_count, total_questions').eq('examinee_id', user.id).order('finished_at', { ascending: false }).limit(5),
        supabase.from('wrong_questions').select('id', { count: 'exact', head: true }).eq('examinee_id', user.id).eq('mastered', false),
        supabase.from('bookmarked_questions').select('id', { count: 'exact', head: true }).eq('examinee_id', user.id),
      ]);
      if (cancelled) return;

      // ---------- Total questions available: drill down through the
      // hierarchy for only the categories this student currently has
      // active access to. ----------
      const now = new Date();
      const activeCategoryIds = (grantsResult.data || [])
        .filter((g) => g.category_id && (!g.expires_at || new Date(g.expires_at) > now))
        .map((g) => g.category_id);

      let totalQuestionsAvailable = 0;
      if (activeCategoryIds.length > 0) {
        const { data: subjects } = await supabase.from('subjects').select('id').in('category_id', activeCategoryIds);
        const subjectIds = (subjects || []).map((s) => s.id);
        if (subjectIds.length > 0) {
          const { data: subcats } = await supabase.from('subcategories').select('id').in('subject_id', subjectIds);
          const subcatIds = (subcats || []).map((s) => s.id);
          if (subcatIds.length > 0) {
            const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
            const chapIds = (chaps || []).map((c) => c.id);
            if (chapIds.length > 0) {
              const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', chapIds).eq('is_active', true);
              totalQuestionsAvailable = count || 0;
            }
          }
        }
      }
      if (cancelled) return;

      // ---------- Exams: total / live / archived / avg / best.
      // Status is computed live from time, same rule as the rest of the app. ----------
      const attempts = examAttemptsResult.data || [];
      let liveCount = 0, archivedCount = 0, sumPct = 0, best = 0;
      attempts.forEach((a) => {
        const end = a.exams?.end_time ? new Date(a.exams.end_time) : null;
        if (end && end < now) archivedCount++; else liveCount++;
        sumPct += a.percentage || 0;
        if ((a.percentage || 0) > best) best = a.percentage;
      });
      const avgScore = attempts.length > 0 ? Math.round((sumPct / attempts.length) * 10) / 10 : 0;

      // ---------- Combined (official + practice) attempted/correct/wrong ----------
      const attempted = (officialAttemptedResult.count || 0) + (practiceAttemptedResult.count || 0);
      const correct = (officialCorrectResult.count || 0) + (practiceCorrectResult.count || 0);
      const wrong = (officialWrongResult.count || 0) + (practiceWrongResult.count || 0);
      const accuracyPct = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;

      setStats({
        totalQuestionsAvailable,
        attempted,
        correct,
        wrong,
        accuracyPct,
        totalExamsAttempted: attempts.length,
        liveCount,
        archivedCount,
        avgScore,
        best,
        wrongForRevision: wrongCountResult.count || 0,
        bookmarked: bookmarkCountResult.count || 0,
      });
      setGrants(grantsResult.data || []);
      setCategories(categoriesResult.data || []);

      // ---------- Recent activity: merge official attempts + practice sessions ----------
      const examActivity = attempts.slice(0, 5).map((a) => ({
        key: `exam_${a.id}`,
        icon: '🎯',
        title: a.exams?.title || 'Exam',
        date: a.submitted_at,
        result: `${a.percentage}%`,
      }));
      const practiceActivity = (practiceSessionsResult.data || []).map((p) => ({
        key: `practice_${p.id}`,
        icon: '📚',
        title: 'Practice session',
        date: p.finished_at,
        result: p.total_questions > 0 ? `${p.correct_count}/${p.total_questions} correct` : '—',
      }));
      const merged = [...examActivity, ...practiceActivity]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
      setRecentActivity(merged);
    }

    load();
    return () => { cancelled = true; };
  }, [user.id]);

  return (
    <>
      <div className="dash-greeting">Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</div>

      <QuickActionsGrid />

      <SubscriptionStrip grants={grants} categories={categories} />

      {stats === null ? (
        <div className="panel"><p className="muted">Loading your stats…</p></div>
      ) : (
        <div className="panel">
          <h2>Exam Overview</h2>
          <div className="stat-grid">
            <StatCard label="Questions Available" value={stats.totalQuestionsAvailable} />
            <StatCard label="Questions Attempted" value={stats.attempted} sub={`${stats.correct} correct · ${stats.wrong} wrong`} />
            <StatCard label="Accuracy" value={`${stats.accuracyPct}%`} />
            <StatCard label="Exams Attempted" value={stats.totalExamsAttempted} sub={`${stats.liveCount} live · ${stats.archivedCount} archived`} />
            <StatCard label="Average Score" value={`${stats.avgScore}%`} />
            <StatCard label="Best Score" value={`${stats.best}%`} />
            <StatCard label="Wrong Questions" value={stats.wrongForRevision} sub="for revision" onClick={() => navigate('/dashboard/practice-session', { state: { session: { mode: 'wrong' } } })} />
            <StatCard label="Bookmarked" value={stats.bookmarked} onClick={() => navigate('/dashboard/bookmarks')} />
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Recent Activity</h2>
        {recentActivity.length === 0 && <p className="muted small">Nothing yet — start a practice session or exam to see your activity here.</p>}
        <div className="recent-list">
          {recentActivity.map((r) => (
            <div key={r.key} className="recent-row">
              <span className="recent-name">{r.icon} {r.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted small">{timeAgo(r.date)}</span>
                <span className="status-pill status-live">{r.result}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

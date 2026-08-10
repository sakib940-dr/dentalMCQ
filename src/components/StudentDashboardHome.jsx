import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { daysLeft, timeAgo } from '../lib/formatters';
import { useAppSetting } from './FeatureLock';
import {
  IconBookOpen,
  IconLibrary,
  IconTarget,
  IconRotateCcw,
  IconHeart,
  IconSearch,
  IconClipboardList,
  IconStethoscope,
  IconMessageCircle,
  IconCheckCircle,
  IconXCircle,
  IconHand,
  IconAward,
  IconTrendingUp,
  IconHelpCircle,
} from '../lib/examineeIcons';

// ============================================================
// Quick actions — the primary "do something" entry points, grouped so
// related features sit together instead of one long flat grid.
// ============================================================
function QuickActionsGrid() {
  const navigate = useNavigate();

  const studyActions = [
    { icon: <IconBookOpen size={26} />, label: 'Question Bank Practice', onClick: () => navigate('/dashboard/question-bank'), featured: true },
    { icon: <IconLibrary size={26} />, label: 'Question Bank (Study)', onClick: () => navigate('/dashboard/question-bank-study'), featured: true },
    { icon: <IconTarget size={26} />, label: 'Start Mock Exam', onClick: () => navigate('/dashboard/exams') },
    { icon: <IconRotateCcw size={26} />, label: 'Wrong Answer Revision', onClick: () => navigate('/dashboard/practice-session', { state: { session: { mode: 'wrong' } } }) },
    { icon: <IconHeart size={26} />, label: 'Bookmarked Questions', onClick: () => navigate('/dashboard/bookmarks'), featured: true },
    { icon: <IconSearch size={26} />, label: 'Smart Search', onClick: () => navigate('/dashboard/search'), featured: true },
  ];
  const chamberActions = [
    { icon: <IconClipboardList size={26} />, label: 'Prescription Tool', onClick: () => navigate('/dashboard/prescription'), featured: true },
    { icon: <IconStethoscope size={26} />, label: 'Dental Chamber', onClick: () => navigate('/dashboard/chamber') },
    { icon: <IconMessageCircle size={26} />, label: 'Help & Support', onClick: () => navigate('/dashboard/support') },
  ];

  const renderTiles = (actions) => (
    <div className="quick-action-grid">
      {actions.map((a) => (
        <button
          key={a.label}
          className={a.featured ? 'quick-action-tile quick-action-tile-featured' : 'quick-action-tile'}
          onClick={a.onClick}
        >
          <span className="quick-action-tile-icon">{a.icon}</span>
          <span className="quick-action-tile-label">{a.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="panel">
      <h2>Quick Actions</h2>
      <div className="quick-action-group-label">Study</div>
      {renderTiles(studyActions)}
      <div className="quick-action-group-label">Chamber &amp; Support</div>
      {renderTiles(chamberActions)}
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
// Performance Analytics — accuracy ring, right-vs-wrong comparison and
// compact accented stat cards. All values come from the same `stats`
// object computed above; this only changes how they're presented.
// ============================================================
function AccuracyDonut({ pct, correct, wrong, unanswered }) {
  return (
    <div className="analytics-summary-row">
      <div className="accuracy-donut" style={{ '--pct': pct }}>
        <div className="accuracy-donut-center">
          <div className="accuracy-donut-value">{pct}%</div>
          <div className="accuracy-donut-caption">Accuracy</div>
        </div>
      </div>
      <div className="accuracy-legend">
        <div className="accuracy-legend-row">
          <span className="accuracy-legend-dot" style={{ background: 'var(--green)' }} />
          <span className="accuracy-legend-label">Correct</span>
          <span className="accuracy-legend-value">{correct}</span>
        </div>
        <div className="accuracy-legend-row">
          <span className="accuracy-legend-dot" style={{ background: 'var(--red)' }} />
          <span className="accuracy-legend-label">Wrong</span>
          <span className="accuracy-legend-value">{wrong}</span>
        </div>
        <div className="accuracy-legend-row">
          <span className="accuracy-legend-dot" style={{ background: 'var(--card-border)' }} />
          <span className="accuracy-legend-label">Unanswered</span>
          <span className="accuracy-legend-value">{unanswered}</span>
        </div>
      </div>
    </div>
  );
}

function RightWrongBars({ correct, wrong }) {
  const max = Math.max(1, correct, wrong);
  const rows = [
    { label: 'Right', count: correct, color: 'var(--green)' },
    { label: 'Wrong', count: wrong, color: 'var(--red)' },
  ];
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

function AnalyticsStatCard({ icon, label, value, sub, accent = 'var(--teal)', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={onClick ? 'analytics-stat-card analytics-stat-card-tappable' : 'analytics-stat-card'}
      style={{ '--stat-accent': accent }}
      onClick={onClick}
    >
      <div className="analytics-stat-icon">{icon}</div>
      <div className="analytics-stat-value">{value}</div>
      <div className="analytics-stat-label">{label}</div>
      {sub && <div className="analytics-stat-sub">{sub}</div>}
    </Tag>
  );
}

// ============================================================
// Upcoming features — visible, honestly non-functional. Same "Soon"
// language as the Chamber tile used before that module was built.
// Content is Super-Admin-managed (upcoming_features table), not
// hardcoded, so the roadmap can change without a code deploy.
// ============================================================
function UpcomingFeaturesPanel() {
  const [features, setFeatures] = useState(null);

  useEffect(() => {
    supabase.from('upcoming_features').select('*').order('display_order').then(({ data }) => setFeatures(data || []));
  }, []);

  if (features !== null && features.length === 0) return null;

  return (
    <details className="panel upcoming-features-panel">
      <summary className="upcoming-features-summary">
        <h2 style={{ display: 'inline', margin: 0 }}>Upcoming Features</h2>
        <span className="muted small"> — tap to see what's coming</span>
      </summary>
      <p className="muted small" style={{ marginTop: 10 }}>On the roadmap — not available yet.</p>
      <div className="quick-action-grid" style={{ marginTop: 14 }}>
        {features?.map((f) => (
          <div key={f.id} className="quick-action-tile quick-action-tile-soon">
            <span className="quick-action-tile-icon">{f.icon}</span>
            <span className="quick-action-tile-label">{f.label}</span>
            <span className="quick-action-tile-badge">Soon</span>
          </div>
        ))}
      </div>
    </details>
  );
}

// ============================================================
// Compact glance-able stats — a curated 4-number summary shown right at
// the top, above Quick Actions. Reuses the same `stats` this component
// already computes for the detailed "Exam Overview" panel further down
// — not a second data-fetch, just a different (smaller, higher-up)
// view of the same numbers.
// ============================================================
function QuickStatsRow({ stats }) {
  if (!stats) return null;
  const items = [
    { icon: <IconLibrary size={16} />, label: 'Questions Attempted', value: stats.attempted },
    { icon: <IconCheckCircle size={16} />, label: 'Total Right', value: stats.correct },
    { icon: <IconXCircle size={16} />, label: 'Total Wrong', value: stats.wrong },
    { icon: <IconTarget size={16} />, label: 'Accuracy', value: `${stats.accuracyPct}%` },
  ];
  return (
    <div className="quick-stats-row">
      {items.map((it) => (
        <div key={it.label} className="quick-stat-card">
          <span className="quick-stat-icon">{it.icon}</span>
          <span className="quick-stat-value">{it.value}</span>
          <span className="quick-stat-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function StudentDashboardHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { value: motivationalLine } = useAppSetting('dashboard_motivational_line', 'Every question you solve today is one step closer to the merit list.');
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
        officialUnansweredResult,
        practiceAttemptedResult,
        practiceCorrectResult,
        practiceWrongResult,
        practiceUnansweredResult,
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
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).is('selected_option', null),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).not('selected_option', 'is', null),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).eq('is_correct', true),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).eq('is_correct', false),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).is('selected_option', null),
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

      // ---------- Combined (official + practice) attempted/correct/wrong/unanswered ----------
      const attempted = (officialAttemptedResult.count || 0) + (practiceAttemptedResult.count || 0);
      const correct = (officialCorrectResult.count || 0) + (practiceCorrectResult.count || 0);
      const wrong = (officialWrongResult.count || 0) + (practiceWrongResult.count || 0);
      const unanswered = (officialUnansweredResult.count || 0) + (practiceUnansweredResult.count || 0);
      const accuracyPct = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;

      setStats({
        totalQuestionsAvailable,
        attempted,
        correct,
        wrong,
        unanswered,
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
        icon: <IconTarget size={14} />,
        title: a.exams?.title || 'Exam',
        date: a.submitted_at,
        result: `${a.percentage}%`,
      }));
      const practiceActivity = (practiceSessionsResult.data || []).map((p) => ({
        key: `practice_${p.id}`,
        icon: <IconLibrary size={14} />,
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
      <div className="dash-greeting">
        <div className="dash-greeting-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Welcome back <IconHand size={15} /></div>
        <div className="dash-greeting-name">{profile?.full_name || 'Doctor'}</div>
        {motivationalLine && <div className="dash-greeting-motivation">{motivationalLine}</div>}
      </div>

      <QuickStatsRow stats={stats} />

      <QuickActionsGrid />

      <SubscriptionStrip grants={grants} categories={categories} />

      {stats === null ? (
        <div className="panel"><p className="muted">Loading your stats…</p></div>
      ) : (
        <div className="panel">
          <h2>Performance Analytics</h2>
          <AccuracyDonut pct={stats.accuracyPct} correct={stats.correct} wrong={stats.wrong} unanswered={stats.unanswered} />
          <RightWrongBars correct={stats.correct} wrong={stats.wrong} />
          <div className="analytics-stat-grid" style={{ marginTop: 18 }}>
            <AnalyticsStatCard icon={<IconLibrary size={16} />} label="Questions Available" value={stats.totalQuestionsAvailable} accent="var(--teal)" />
            <AnalyticsStatCard icon={<IconClipboardList size={16} />} label="Questions Attempted" value={stats.attempted} sub={`${stats.correct} correct · ${stats.wrong} wrong`} accent="var(--blue)" />
            <AnalyticsStatCard icon={<IconTarget size={16} />} label="Exams Attempted" value={stats.totalExamsAttempted} sub={`${stats.liveCount} live · ${stats.archivedCount} archived`} accent="var(--purple)" />
            <AnalyticsStatCard icon={<IconTrendingUp size={16} />} label="Average Score" value={`${stats.avgScore}%`} accent="var(--gold)" />
            <AnalyticsStatCard icon={<IconAward size={16} />} label="Best Score" value={`${stats.best}%`} accent="var(--green)" />
            <AnalyticsStatCard icon={<IconHelpCircle size={16} />} label="Unanswered" value={stats.unanswered} accent="var(--ink-soft)" />
            <AnalyticsStatCard icon={<IconXCircle size={16} />} label="Wrong Questions" value={stats.wrongForRevision} sub="for revision" accent="var(--red)" onClick={() => navigate('/dashboard/practice-session', { state: { session: { mode: 'wrong' } } })} />
            <AnalyticsStatCard icon={<IconHeart size={16} />} label="Bookmarked" value={stats.bookmarked} accent="var(--gold)" onClick={() => navigate('/dashboard/bookmarks')} />
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Recent Activity</h2>
        {recentActivity.length === 0 && <p className="muted small">Nothing yet — start a practice session or exam to see your activity here.</p>}
        <div className="recent-list">
          {recentActivity.map((r) => (
            <div key={r.key} className="recent-row">
              <span className="recent-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{r.icon} {r.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="muted small">{timeAgo(r.date)}</span>
                <span className="status-pill status-live">{r.result}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <UpcomingFeaturesPanel />
    </>
  );
}

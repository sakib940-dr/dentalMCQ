import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { timeAgo } from '../lib/formatters';
import {
  IconActivity,
  IconAward,
  IconArrowRight,
  IconBarChart,
  IconBookOpen,
  IconBookmark,
  IconCalendar,
  IconClipboardList,
  IconHeart,
  IconLibrary,
  IconMessageCircle,
  IconPieChart,
  IconRotateCcw,
  IconSearch,
  IconStethoscope,
  IconTarget,
  IconTrendingUp,
  IconXCircle,
} from '../lib/examineeIcons';

// Rotating accent palette used across quick actions, subject donuts and
// KPI icon chips — every color here maps to an existing theme token
// (var(--teal) etc.) plus its soft tint (var(--teal-tint) etc.), both
// already defined in App.css.
const ACCENTS = ['teal', 'blue', 'purple', 'gold', 'green', 'red'];

// ============================================================
// 1. Compact date header — replaces the old large "Welcome back /
// Name" banner. Just the day name + full date, minimal vertical
// space. The user's identity still shows on the Profile page; this
// is dashboard-only real estate we're reclaiming.
// ============================================================
function CompactDateHeader() {
  const today = new Date();
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'long' });
  const dateLabel = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="home-date-compact">
      <IconCalendar size={15} />
      <span className="home-date-compact-day">{weekday}</span>
      <span className="home-date-compact-date">{dateLabel}</span>
    </div>
  );
}

// ============================================================
// 2. Quick actions — same routes/features as before, restyled as slim
// colorful horizontal rows instead of square icon tiles.
// ============================================================
function QuickActionsRail() {
  const navigate = useNavigate();

  const studyActions = [
    { icon: <IconBookOpen size={18} />, label: 'Question Bank Practice', onClick: () => navigate('/dashboard/question-bank') },
    { icon: <IconLibrary size={18} />, label: 'Question Bank (Study)', onClick: () => navigate('/dashboard/question-bank-study') },
    { icon: <IconTarget size={18} />, label: 'Start Mock Exam', onClick: () => navigate('/dashboard/exams') },
    { icon: <IconRotateCcw size={18} />, label: 'Wrong Answer Revision', onClick: () => navigate('/dashboard/practice-session', { state: { session: { mode: 'wrong' } } }) },
    { icon: <IconHeart size={18} />, label: 'Bookmarked Questions', onClick: () => navigate('/dashboard/bookmarks') },
    { icon: <IconSearch size={18} />, label: 'Smart Search', onClick: () => navigate('/dashboard/search') },
  ];
  const chamberActions = [
    { icon: <IconClipboardList size={18} />, label: 'Prescription Tool', onClick: () => navigate('/dashboard/prescription') },
    { icon: <IconStethoscope size={18} />, label: 'Dental Chamber', onClick: () => navigate('/dashboard/chamber') },
    { icon: <IconMessageCircle size={18} />, label: 'Help & Support', onClick: () => navigate('/dashboard/support') },
  ];

  const renderRows = (actions, offset) => (
    <div className="qa-rail">
      {actions.map((a, i) => {
        const accent = ACCENTS[(i + offset) % ACCENTS.length];
        return (
          <button
            key={a.label}
            className="qa-row"
            style={{ '--qa-bg': `var(--${accent}-tint)`, '--qa-fg': `var(--${accent})` }}
            onClick={a.onClick}
          >
            <span className="qa-row-icon">{a.icon}</span>
            <span className="qa-row-label">{a.label}</span>
            <IconArrowRight size={16} className="qa-row-chevron" />
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="panel">
      <h2>Quick Actions</h2>
      <div className="quick-action-group-label">Study</div>
      {renderRows(studyActions, 0)}
      <div className="quick-action-group-label">Chamber &amp; Support</div>
      {renderRows(chamberActions, studyActions.length)}
    </div>
  );
}

// ============================================================
// 3. Performance analytics — accuracy donut + right/wrong compare bars.
// Same underlying stats (accuracyPct, correct, wrong, unanswered) as
// before; only the presentation changed.
// ============================================================
function PerformanceAnalyticsCard({ stats }) {
  const { accuracyPct: pct, correct, wrong, unanswered } = stats;
  const max = Math.max(1, correct, wrong);

  return (
    <div className="panel">
      <h2 className="panel-title-row"><IconActivity size={17} /> Performance Analytics</h2>

      <div className="perf-donut-row">
        <div className="perf-donut" style={{ '--pct': pct }}>
          <div className="perf-donut-center">
            <div className="perf-donut-value">{pct}%</div>
            <div className="perf-donut-caption">Accuracy</div>
          </div>
        </div>
        <div className="perf-legend">
          <div className="perf-legend-row">
            <span className="perf-legend-dot" style={{ background: 'var(--green)' }} />
            <span className="perf-legend-label">Correct</span>
            <span className="perf-legend-value" style={{ color: 'var(--green)' }}>{correct}</span>
          </div>
          <div className="perf-legend-row">
            <span className="perf-legend-dot" style={{ background: 'var(--red)' }} />
            <span className="perf-legend-label">Wrong</span>
            <span className="perf-legend-value" style={{ color: 'var(--red)' }}>{wrong}</span>
          </div>
          <div className="perf-legend-row">
            <span className="perf-legend-dot" style={{ background: 'var(--ink-soft)' }} />
            <span className="perf-legend-label">Unanswered</span>
            <span className="perf-legend-value">{unanswered}</span>
          </div>
        </div>
      </div>

      <div className="perf-compare">
        {[{ label: 'Right', count: correct, color: 'var(--green)' }, { label: 'Wrong', count: wrong, color: 'var(--red)' }].map((r) => (
          <div key={r.label} className="perf-compare-row">
            <span className="perf-compare-label">{r.label}</span>
            <div className="perf-compare-track">
              <div className="perf-compare-fill" style={{ width: `${(r.count / max) * 100}%`, '--fill-color': r.color }} />
            </div>
            <span className="perf-compare-value">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 4. Subject-wise question distribution — real counts from the
// student's active category tree, one small donut card per subject.
// ============================================================
function SubjectDistributionCard({ subjects, totalAvailable }) {
  if (!subjects || subjects.length === 0) return null;

  return (
    <div className="panel">
      <h2 className="panel-title-row"><IconPieChart size={17} /> Questions by Subject</h2>
      <p className="muted small panel-title-sub">{totalAvailable} total questions across {subjects.length} subject{subjects.length === 1 ? '' : 's'}</p>
      <div className="subject-grid">
        {subjects.map((s, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          const pct = totalAvailable > 0 ? Math.round((s.count / totalAvailable) * 100) : 0;
          return (
            <div key={s.id} className="subject-card">
              <div className="subject-card-donut" style={{ '--pct': pct, '--donut-color': `var(--${accent})` }}>
                <div className="subject-card-donut-center">{pct}%</div>
              </div>
              <div className="subject-card-info">
                <div className="subject-card-name" title={s.name}>{s.name}</div>
                <div className="subject-card-count">{s.count} questions</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 5. Weekly question activity — questions attempted per day (official
// exam questions + practice questions), last 7 days, area/line chart.
// ============================================================
function WeeklyQuestionActivityChart({ days }) {
  const W = 320, H = 92, padX = 10, padTop = 10, padBottom = 10;
  const max = Math.max(1, ...days.map((d) => d.questionCount));
  const stepX = days.length > 1 ? (W - padX * 2) / (days.length - 1) : 0;
  const points = days.map((d, i) => {
    const x = padX + i * stepX;
    const y = H - padBottom - (d.questionCount / max) * (H - padTop - padBottom);
    return { x, y, ...d };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - padBottom} L${points[0].x.toFixed(1)},${H - padBottom} Z`;
  const totalThisWeek = days.reduce((sum, d) => sum + d.questionCount, 0);

  return (
    <div className="panel">
      <h2 className="panel-title-row"><IconTrendingUp size={17} /> Weekly Question Activity</h2>
      <p className="muted small panel-title-sub">Questions attempted per day — last 7 days</p>
      <div className="wk-line-wrap">
        <div className="wk-line-svg-box">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="wkQuestionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#wkQuestionGrad)" stroke="none" />
            <path d={linePath} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#fff" stroke="var(--teal)" strokeWidth="2" />
            ))}
          </svg>
        </div>
        <div className="wk-line-labels">
          {days.map((d, i) => (
            <div key={i} className="wk-line-label-col">
              <span className="wk-line-val">{d.questionCount}</span>
              <span className="wk-line-day">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      {totalThisWeek === 0 && <p className="muted small wk-empty-note">No question activity yet this week — start a practice session to see it here.</p>}
    </div>
  );
}

// ============================================================
// 6. Weekly exam activity — official exam attempts per day, split into
// live vs archived (same "end_time < now" rule used for the overall
// live/archived counts elsewhere on this dashboard).
// ============================================================
function WeeklyExamActivityChart({ days }) {
  const maxCount = Math.max(1, ...days.map((d) => d.examCount));
  const AREA_H = 80;
  const totalThisWeek = days.reduce((sum, d) => sum + d.examCount, 0);

  return (
    <div className="panel">
      <h2 className="panel-title-row"><IconBarChart size={17} /> Weekly Exam Activity</h2>
      <p className="muted small panel-title-sub">Exam attempts per day — last 7 days</p>
      <div className="wk-bar-chart">
        {days.map((d, i) => {
          const liveH = Math.round((d.examLive / maxCount) * AREA_H);
          const archH = Math.round((d.examArchived / maxCount) * AREA_H);
          return (
            <div key={i} className="wk-bar-col">
              <div className="wk-bar-area">
                {d.examCount === 0 ? (
                  <div className="wk-bar-empty" />
                ) : (
                  <div className="wk-bar-track">
                    <div className="wk-bar-seg-archived" style={{ height: `${archH}px` }} />
                    <div className="wk-bar-seg-live" style={{ height: `${liveH}px` }} />
                  </div>
                )}
              </div>
              <span className="wk-bar-total">{d.examCount}</span>
              <span className="wk-bar-day">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="wk-bar-legend">
        <span className="wk-bar-legend-item"><span className="wk-bar-legend-dot" style={{ background: 'var(--gold)' }} /> Live</span>
        <span className="wk-bar-legend-item"><span className="wk-bar-legend-dot" style={{ background: 'var(--teal)' }} /> Archived</span>
      </div>
      {totalThisWeek === 0 && <p className="muted small wk-empty-note">No exam attempts yet this week.</p>}
    </div>
  );
}

// ============================================================
// 7. Key performance summary — compact, non-repetitive cards for the
// remaining headline numbers (Questions Available/Unanswered stay
// visible above, in Performance Analytics / Subject sections instead
// of being duplicated here).
// ============================================================
function KeyPerformanceSummary({ stats, navigate }) {
  const items = [
    { icon: <IconClipboardList size={16} />, label: 'Questions Attempted', value: stats.attempted, accent: 'blue' },
    { icon: <IconTrendingUp size={16} />, label: 'Average Score', value: `${stats.avgScore}%`, accent: 'gold' },
    { icon: <IconAward size={16} />, label: 'Best Score', value: `${stats.best}%`, accent: 'green' },
    { icon: <IconTarget size={16} />, label: 'Exams Attempted', value: stats.totalExamsAttempted, accent: 'purple' },
    { icon: <IconXCircle size={16} />, label: 'Wrong Questions', value: stats.wrongForRevision, accent: 'red', onClick: () => navigate('/dashboard/practice-session', { state: { session: { mode: 'wrong' } } }) },
    { icon: <IconBookmark size={16} />, label: 'Bookmarked', value: stats.bookmarked, accent: 'teal', onClick: () => navigate('/dashboard/bookmarks') },
  ];

  return (
    <div className="panel">
      <h2>Key Performance Summary</h2>
      <div className="kpi-grid">
        {items.map((it) => {
          const Tag = it.onClick ? 'button' : 'div';
          return (
            <Tag
              key={it.label}
              className={it.onClick ? 'kpi-card kpi-card-tap' : 'kpi-card'}
              style={{ '--kpi-bg': `var(--${it.accent}-tint)`, '--kpi-fg': `var(--${it.accent})` }}
              onClick={it.onClick}
            >
              <span className="kpi-card-icon">{it.icon}</span>
              <div className="kpi-card-text">
                <span className="kpi-card-value">{it.value}</span>
                <span className="kpi-card-label">{it.label}</span>
              </div>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Upcoming features — unchanged from before (visible, honestly
// non-functional, content managed via the upcoming_features table).
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

// Builds an array of the last `count` local-midnight Date objects,
// oldest first, ending today — the shared day-bucket scaffold for both
// weekly charts.
function buildLastNDays(count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}
function dayKey(d) {
  return d.toDateString();
}

export default function StudentDashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const [
        grantsResult,
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
        weeklyPracticeSessionsResult,
        wrongCountResult,
        bookmarkCountResult,
      ] = await Promise.all([
        supabase.from('category_access_grants').select('*').eq('examinee_id', user.id),
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).not('selected_option', 'is', null),
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).eq('is_correct', true),
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).eq('is_correct', false),
        supabase.from('attempt_answers').select('id, exam_attempts!inner(examinee_id)', { count: 'exact', head: true }).eq('exam_attempts.examinee_id', user.id).is('selected_option', null),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).not('selected_option', 'is', null),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).eq('is_correct', true),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).eq('is_correct', false),
        supabase.from('practice_answers').select('id, practice_sessions!inner(examinee_id)', { count: 'exact', head: true }).eq('practice_sessions.examinee_id', user.id).is('selected_option', null),
        supabase.from('exam_attempts').select('id, percentage, submitted_at, exams(title, end_time, total_questions)').eq('examinee_id', user.id).eq('attempt_type', 'official').eq('status', 'submitted').order('submitted_at', { ascending: false }),
        supabase.from('practice_sessions').select('id, finished_at, correct_count, total_questions').eq('examinee_id', user.id).order('finished_at', { ascending: false }).limit(5),
        supabase.from('practice_sessions').select('finished_at, total_questions').eq('examinee_id', user.id).gte('finished_at', sevenDaysAgo.toISOString()),
        supabase.from('wrong_questions').select('id', { count: 'exact', head: true }).eq('examinee_id', user.id).eq('mastered', false),
        supabase.from('bookmarked_questions').select('id', { count: 'exact', head: true }).eq('examinee_id', user.id),
      ]);
      if (cancelled) return;

      // ---------- Active categories this student currently has access to ----------
      const activeCategoryIds = (grantsResult.data || [])
        .filter((g) => g.category_id && (!g.expires_at || new Date(g.expires_at) > now))
        .map((g) => g.category_id);

      // ---------- Total questions available + subject-wise breakdown:
      // drill down category -> subjects -> subcategories -> chapters ->
      // active questions, same hierarchy used everywhere else in the
      // app, then group the same chapter set by subject. ----------
      let totalQuestionsAvailable = 0;
      let subjectDistribution = [];
      if (activeCategoryIds.length > 0) {
        const { data: subjects } = await supabase.from('subjects').select('id, name').in('category_id', activeCategoryIds);
        const subjectIds = (subjects || []).map((s) => s.id);
        if (subjectIds.length > 0) {
          const { data: subcats } = await supabase.from('subcategories').select('id, subject_id').in('subject_id', subjectIds);
          const subcatToSubject = new Map((subcats || []).map((sc) => [sc.id, sc.subject_id]));
          const subcatIds = (subcats || []).map((sc) => sc.id);
          if (subcatIds.length > 0) {
            const { data: chaps } = await supabase.from('chapters').select('id, subcategory_id').in('subcategory_id', subcatIds);
            const chapIds = (chaps || []).map((c) => c.id);
            if (chapIds.length > 0) {
              const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', chapIds).eq('is_active', true);
              totalQuestionsAvailable = count || 0;

              const subjectChapterMap = new Map();
              (chaps || []).forEach((c) => {
                const sid = subcatToSubject.get(c.subcategory_id);
                if (!sid) return;
                if (!subjectChapterMap.has(sid)) subjectChapterMap.set(sid, []);
                subjectChapterMap.get(sid).push(c.id);
              });
              const subjectNameById = new Map((subjects || []).map((s) => [s.id, s.name]));
              const subjectCountEntries = await Promise.all(
                Array.from(subjectChapterMap.entries()).map(async ([sid, cids]) => {
                  const { count: sc } = await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', cids).eq('is_active', true);
                  return { id: sid, name: subjectNameById.get(sid) || 'Subject', count: sc || 0 };
                })
              );
              subjectDistribution = subjectCountEntries.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
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

      // ---------- Weekly activity: last 7 days, bucketed from the same
      // real rows used above — exam attempts (with each exam's
      // total_questions) plus every practice session finished this week
      // (not just the 5 shown in Recent Activity). ----------
      const dayList = buildLastNDays(7);
      const buckets = new Map(dayList.map((d) => [dayKey(d), {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        questionCount: 0,
        examCount: 0,
        examLive: 0,
        examArchived: 0,
      }]));
      attempts.forEach((a) => {
        if (!a.submitted_at) return;
        const d = new Date(a.submitted_at);
        if (d < sevenDaysAgo) return;
        const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const bucket = buckets.get(dayKey(localMidnight));
        if (!bucket) return;
        bucket.examCount += 1;
        bucket.questionCount += a.exams?.total_questions || 0;
        const end = a.exams?.end_time ? new Date(a.exams.end_time) : null;
        if (end && end < now) bucket.examArchived += 1; else bucket.examLive += 1;
      });
      (weeklyPracticeSessionsResult.data || []).forEach((p) => {
        if (!p.finished_at) return;
        const d = new Date(p.finished_at);
        const localMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const bucket = buckets.get(dayKey(localMidnight));
        if (!bucket) return;
        bucket.questionCount += p.total_questions || 0;
      });
      const weeklyDays = dayList.map((d) => buckets.get(dayKey(d)));

      setStats({
        totalQuestionsAvailable,
        subjectDistribution,
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
        weeklyDays,
      });

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
      <CompactDateHeader />

      <QuickActionsRail />

      {stats === null ? (
        <div className="panel"><p className="muted">Loading your stats…</p></div>
      ) : (
        <>
          <PerformanceAnalyticsCard stats={stats} />
          <SubjectDistributionCard subjects={stats.subjectDistribution} totalAvailable={stats.totalQuestionsAvailable} />
          <WeeklyQuestionActivityChart days={stats.weeklyDays} />
          <WeeklyExamActivityChart days={stats.weeklyDays} />
          <KeyPerformanceSummary stats={stats} navigate={navigate} />
        </>
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

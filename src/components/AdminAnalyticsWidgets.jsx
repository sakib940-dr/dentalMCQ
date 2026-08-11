// Shared analytics widgets for the Admin / Moderator dashboards.
//
// Extracted so SuperAdminOverview (role: super_admin, at /admin) and
// ModeratorOverview (role: admin/moderator, at /moderator) render the
// exact same compact, mobile-first analytics look — matching the
// redesigned Examinee Dashboard's visual language (teal/gold accents,
// rounded cards, donut/bar/area charts) — without duplicating markup.
//
// Every chart here is fed real rows already fetched by the caller from
// Supabase; nothing in this file invents or fabricates data.
import { useState } from 'react';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheckCircle,
} from '../lib/adminIcons';

// ---------- Day-bucket helpers (shared by both overview pages) ----------

// Builds the last `n` local-midnight Date objects, oldest first, ending today.
export function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

// Counts how many rows fall on each day (by a date field), e.g. new sign-ups per day.
export function bucketCountByDay(rows, dateField, days) {
  return days.map((d) => {
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const count = (rows || []).filter((r) => r[dateField] && new Date(r[dateField]).toDateString() === d.toDateString()).length;
    return { label, count };
  });
}

// Counts DISTINCT idField values per day — e.g. a user who practices 5
// times on Monday counts once for Monday, not 5 times.
export function bucketUniqueCountByDay(rows, dateField, idField, days) {
  return days.map((d) => {
    const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const ids = new Set(
      (rows || [])
        .filter((r) => r[dateField] && r[idField] && new Date(r[dateField]).toDateString() === d.toDateString())
        .map((r) => r[idField])
    );
    return { label, count: ids.size };
  });
}

// ============================================================
// 1. Header — title + subtitle on the left, compact date chip
// on the right. Reuses the exact classes from the Examinee
// Dashboard's welcome header so the two feel like one product.
// ============================================================
export function AdminAnalyticsHeader({ title, subtitle }) {
  const today = new Date();
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'short' });
  const dateLabel = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="home-welcome">
      <div className="home-welcome-text">
        <div className="home-welcome-name" style={{ fontSize: 20 }}>{title}</div>
        {subtitle && <div className="home-welcome-sub" style={{ fontStyle: 'normal', maxWidth: 260 }}>{subtitle}</div>}
      </div>
      <div className="home-date-chip">
        <IconCalendar size={16} />
        <div className="home-date-chip-text">
          <span className="home-date-chip-day">{weekday}</span>
          <span className="home-date-chip-date">{dateLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 2 & 5. Compact vertical bar chart panel — used for Weekly
// Registration and Unique Practice Users.
// ============================================================
export function WeeklyBarPanel({ icon, title, subtitle, data, color = 'var(--teal)', colorDeep = 'var(--teal-deep)', emptyLabel }) {
  const total = (data || []).reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...(data || []).map((d) => d.count));
  return (
    <div className="panel analytics-chart-panel">
      <h2 className="panel-title-row">{icon} {title}</h2>
      {subtitle && <p className="muted small analytics-chart-sub">{subtitle}</p>}
      <div className="analytics-bar-chart">
        {(data || []).map((d, i) => (
          <div key={i} className="analytics-bar-col">
            <div className="analytics-bar-wrap">
              <div className="analytics-bar" style={{ height: `${(d.count / max) * 100}%`, '--bar-color': color, '--bar-color-deep': colorDeep }} />
            </div>
            <div className="analytics-bar-value">{d.count}</div>
            <div className="analytics-bar-label">{d.label}</div>
          </div>
        ))}
      </div>
      {total === 0 && emptyLabel && <p className="muted small wk-empty-note">{emptyLabel}</p>}
    </div>
  );
}

// ============================================================
// 3. Compact area/line chart panel — used for Live Exam
// Participation. Reuses the exact SVG shape from the Examinee
// Dashboard's Weekly Question Activity chart, generalized to any
// {label, count}[] series.
// ============================================================
export function AreaLineChartPanel({ icon, title, subtitle, days, color = 'var(--teal)', gradientId, emptyLabel }) {
  const W = 320, H = 92, padX = 10, padTop = 10, padBottom = 10;
  const list = days || [];
  const max = Math.max(1, ...list.map((d) => d.count));
  const stepX = list.length > 1 ? (W - padX * 2) / (list.length - 1) : 0;
  const points = list.map((d, i) => {
    const x = padX + i * stepX;
    const y = H - padBottom - (d.count / max) * (H - padTop - padBottom);
    return { x, y, ...d };
  });
  const linePath = points.length ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : '';
  const areaPath = points.length ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${H - padBottom} L${points[0].x.toFixed(1)},${H - padBottom} Z` : '';
  const total = list.reduce((sum, d) => sum + d.count, 0);
  const gid = gradientId || 'adminAreaGrad';

  return (
    <div className="panel analytics-chart-panel">
      <h2 className="panel-title-row">{icon} {title}</h2>
      {subtitle && <p className="muted small analytics-chart-sub">{subtitle}</p>}
      <div className="wk-line-wrap">
        <div className="wk-line-svg-box">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {points.length > 0 && <path d={areaPath} fill={`url(#${gid})`} stroke="none" />}
            {points.length > 0 && <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#fff" stroke={color} strokeWidth="2" />
            ))}
          </svg>
        </div>
        <div className="wk-line-labels">
          {list.map((d, i) => (
            <div key={i} className="wk-line-label-col">
              <span className="wk-line-val">{d.count}</span>
              <span className="wk-line-day">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      {total === 0 && emptyLabel && <p className="muted small wk-empty-note">{emptyLabel}</p>}
    </div>
  );
}

// ============================================================
// 4. Payment Overview — donut with 3 real segments (pending /
// approved / rejected) built from actual payment_claims counts.
// A status with 0 records renders correctly as 0.
// ============================================================
export function PaymentOverviewPanel({ pending, approved, rejected, icon }) {
  const total = pending + approved + rejected;
  const rows = [
    { label: 'Pending', count: pending, color: 'var(--gold)' },
    { label: 'Accepted', count: approved, color: 'var(--green)' },
    { label: 'Rejected', count: rejected, color: 'var(--red)' },
  ];

  // Build a conic-gradient string from real counts only (no fabricated segments).
  let gradient;
  if (total === 0) {
    gradient = '#EFE9DA';
  } else {
    let acc = 0;
    const stops = rows.map((r) => {
      const startPct = (acc / total) * 100;
      acc += r.count;
      const endPct = (acc / total) * 100;
      return `${r.color} ${startPct}% ${endPct}%`;
    });
    gradient = `conic-gradient(${stops.join(', ')})`;
  }

  return (
    <div className="panel analytics-chart-panel">
      <h2 className="panel-title-row">{icon} Payment Overview</h2>
      <p className="muted small analytics-chart-sub">Payment claims by status — all-time</p>
      <div className="perf-donut-row">
        <div className="multi-donut" style={{ background: gradient }}>
          <div className="perf-donut-center">
            <div className="perf-donut-value">{total}</div>
            <div className="perf-donut-caption">Total</div>
          </div>
        </div>
        <div className="perf-legend">
          {rows.map((r) => (
            <div key={r.label} className="perf-legend-row">
              <span className="perf-legend-dot" style={{ background: r.color }} />
              <span className="perf-legend-label">{r.label}</span>
              <span className="perf-legend-value" style={{ color: r.color }}>{r.count}</span>
            </div>
          ))}
        </div>
      </div>
      {total === 0 && <p className="muted small wk-empty-note">No payment claims recorded yet.</p>}
    </div>
  );
}

// ============================================================
// 6. Subject-wise question count — donut-per-subject grid, same
// visual language as the Examinee Dashboard's "Questions by
// Subject" card, with a compact "View All" toggle for long lists.
// ============================================================
export function SubjectQuestionsPanel({ subjects, icon, visibleCount = 6 }) {
  const [expanded, setExpanded] = useState(false);
  const list = subjects || [];
  const total = list.reduce((s, x) => s + x.count, 0);
  const shown = expanded ? list : list.slice(0, visibleCount);
  const accents = ['teal', 'blue', 'purple', 'gold', 'green', 'red'];

  if (list.length === 0) {
    return (
      <div className="panel">
        <h2 className="panel-title-row">{icon} Subject-wise Question Count</h2>
        <p className="muted small" style={{ marginTop: 10 }}>No questions in the bank yet.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title-row">{icon} Subject-wise Question Count</h2>
      <p className="muted small panel-title-sub">{total} total question{total === 1 ? '' : 's'} across {list.length} subject{list.length === 1 ? '' : 's'}</p>
      <div className="subject-grid">
        {shown.map((s, i) => {
          const accent = accents[i % accents.length];
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={s.id} className="subject-card">
              <div className="subject-card-donut" style={{ '--pct': pct, '--donut-color': `var(--${accent})` }}>
                <div className="subject-card-donut-center">{pct}%</div>
              </div>
              <div className="subject-card-info">
                <div className="subject-card-name" title={s.name}>{s.name}</div>
                <div className="subject-card-count">{s.count} question{s.count === 1 ? '' : 's'}</div>
              </div>
            </div>
          );
        })}
      </div>
      {list.length > visibleCount && (
        <button className="btn-secondary sm" style={{ marginTop: 12 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `View All (${list.length})`}
        </button>
      )}
    </div>
  );
}

// ============================================================
// 7. Needs Attention — only ever renders real, currently-true
// database conditions. Shows a clean "all caught up" empty state
// instead of any placeholder/fake warning.
// ============================================================
export function NeedsAttentionPanel({ items }) {
  const list = items || [];
  return (
    <div className="panel">
      <h2>Needs attention</h2>
      {list.length === 0 ? (
        <div className="attention-empty">
          <IconCheckCircle size={20} />
          <div>
            <div className="attention-empty-title">All caught up</div>
            <div className="muted small">No pending actions require your attention.</div>
          </div>
        </div>
      ) : (
        <div className="attention-list">
          {list.map((a, i) => (
            <div key={i} className="attention-row" onClick={a.onClick} style={a.onClick ? { cursor: 'pointer' } : undefined}>
              <span className="attention-icon"><IconAlertTriangle size={16} /></span>
              <div>
                <div className="attention-name">{a.name}</div>
                <div className="muted small">{a.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

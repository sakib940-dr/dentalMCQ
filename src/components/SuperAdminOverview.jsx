import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

function MiniBarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="mini-chart">
      {data.map((d) => (
        <div key={d.label} className="mini-chart-col">
          <div className="mini-chart-bar-wrap">
            <div className="mini-chart-bar" style={{ height: `${(d.count / max) * 100}%` }} />
          </div>
          <div className="mini-chart-label">{d.label}</div>
          <div className="mini-chart-value">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

export default function SuperAdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [attention, setAttention] = useState([]);
  const [signupChart, setSignupChart] = useState([]);
  const [topExams, setTopExams] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
        { count: activeSubscriptions },
        revenueResult,
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
        supabase.from('category_access_grants').select('id', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString()),
        supabase.from('payment_claims').select('final_amount').eq('status', 'approved').neq('method', 'discount_claim'),
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
      });
      setRecentUsers(usersResult.data || []);
      setRecentAttempts(attemptsResult.data || []);

      // Attention: subjects with fewer than 5 questions in their chapters
      const subjectAttention = [];
      for (const s of (subjectsResult.data || []).slice(0, 30)) {
        const { data: subcats } = await supabase.from('subcategories').select('id').eq('subject_id', s.id);
        const subcatIds = (subcats || []).map((x) => x.id);
        if (subcatIds.length === 0) { subjectAttention.push({ type: 'subject', name: s.name, reason: 'No chapters set up yet' }); continue; }
        const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
        const chapIds = (chaps || []).map((c) => c.id);
        if (chapIds.length === 0) continue;
        const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', chapIds).eq('is_active', true);
        if ((count || 0) < 5) subjectAttention.push({ type: 'subject', name: s.name, reason: `Only ${count || 0} question${count === 1 ? '' : 's'}` });
      }
      if (cancelled) return;
      setAttention(subjectAttention.slice(0, 5));

      // Signups over the last 7 days
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d);
      }
      const { data: recentSignups } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', days[0].toISOString());
      if (cancelled) return;
      const chartData = days.map((d) => {
        const label = d.toLocaleDateString('en-GB', { weekday: 'short' });
        const count = (recentSignups || []).filter((r) => new Date(r.created_at).toDateString() === d.toDateString()).length;
        return { label, count };
      });
      setSignupChart(chartData);

      // Top exams by attempt count
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
  }, []);

  if (!stats) return <div className="panel"><p className="muted">Loading overview…</p></div>;

  return (
    <>
      <div className="panel">
        <h2>Super Admin Overview</h2>
        <p className="muted small">A snapshot of your exam platform.</p>

        <div className="stat-grid">
          <StatCard label="Questions" value={stats.totalQuestions} />
          <StatCard label="Students" value={stats.totalStudents} />
          <StatCard label="Moderators" value={stats.totalModerators} />
          <StatCard label="Subjects" value={stats.totalSubjects} />
          <StatCard label="Categories" value={stats.totalCategories} />
          <StatCard label="Total Exams" value={stats.totalExams} sub={`${stats.live} live · ${stats.upcoming} upcoming`} />
          <StatCard label="Attempts Today" value={stats.attemptsToday} />
          <StatCard label="Archived Exams" value={stats.archived} />
          <StatCard label="Pending Payments" value={stats.pendingClaims} sub={stats.pendingClaims > 0 ? 'Needs review' : undefined} />
          <StatCard label="Active Subscriptions" value={stats.activeSubscriptions} />
          <StatCard label="Total Revenue" value={`৳${stats.totalRevenue.toFixed(0)}`} />
        </div>
      </div>

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

      {attention.length > 0 && (
        <div className="panel">
          <h2>Needs attention</h2>
          <div className="attention-list">
            {attention.map((a, i) => (
              <div key={i} className="attention-row">
                <span className="attention-icon">⚠️</span>
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
        <h2>New sign-ups (7 days)</h2>
        <MiniBarChart data={signupChart} />
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
    </>
  );
}

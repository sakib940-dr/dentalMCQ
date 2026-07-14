import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-value">{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [
        { count: totalQuestions },
        { count: totalSubjects },
        { count: totalCategories },
        { data: examStatusRows },
        { count: attemptsToday },
        attemptsResult,
        subjectsResult,
      ] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('subjects').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('start_time, end_time, is_published'),
        supabase.from('exam_attempts').select('id', { count: 'exact', head: true }).gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('exam_attempts').select('*, profiles(full_name), exams(title)').eq('status', 'submitted').order('submitted_at', { ascending: false }).limit(5),
        supabase.from('subjects').select('id, name, category_id'),
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

      const subjectAttention = [];
      for (const s of (subjectsResult.data || []).slice(0, 30)) {
        const { data: subcats } = await supabase.from('subcategories').select('id').eq('subject_id', s.id);
        const subcatIds = (subcats || []).map((x) => x.id);
        if (subcatIds.length === 0) { subjectAttention.push({ name: s.name, reason: 'No chapters set up yet' }); continue; }
        const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
        const chapIds = (chaps || []).map((c) => c.id);
        if (chapIds.length === 0) continue;
        const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', chapIds).eq('is_active', true);
        if ((count || 0) < 5) subjectAttention.push({ name: s.name, reason: `Only ${count || 0} question${count === 1 ? '' : 's'}` });
      }
      if (cancelled) return;
      setAttention(subjectAttention.slice(0, 5));
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (!stats) return <div className="panel"><p className="muted">Loading overview…</p></div>;

  return (
    <>
      <div className="panel">
        <h2>Moderator Overview</h2>
        <p className="muted small">A snapshot of the question bank and exams you help manage.</p>

        <div className="stat-grid">
          <StatCard label="Questions" value={stats.totalQuestions} />
          <StatCard label="Subjects" value={stats.totalSubjects} />
          <StatCard label="Categories" value={stats.totalCategories} />
          <StatCard label="Total Exams" value={stats.totalExams} sub={`${stats.live} live · ${stats.upcoming} upcoming`} />
          <StatCard label="Attempts Today" value={stats.attemptsToday} />
          <StatCard label="Archived Exams" value={stats.archived} />
        </div>
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

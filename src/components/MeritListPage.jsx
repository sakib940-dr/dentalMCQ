import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function CategoryPicker({ onPick }) {
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  if (categories === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>Merit Lists</h2>
      <p className="muted small">Pick a category, then an exam whose window has closed to see the ranked merit list.</p>
      <div className="category-pick-grid">
        {categories.map((c) => (
          <button key={c.id} className="category-pick-card" onClick={() => onPick(c)}>{c.name}</button>
        ))}
      </div>
    </div>
  );
}

function ClosedExamList({ category, onBack, onOpen }) {
  const [exams, setExams] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('exams')
      .select('*')
      .eq('category_id', category.id)
      .eq('is_published', true)
      .lt('end_time', new Date().toISOString())
      .order('end_time', { ascending: false })
      .then(({ data }) => { if (!cancelled) setExams(data || []); });
    return () => { cancelled = true; };
  }, [category.id]);

  if (exams === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Categories</button>
      <h2>{category.name} — Merit Lists</h2>
      {exams.length === 0 && <div className="muted">No closed exams yet in this category.</div>}
      <div className="exam-list-wrap">
        {exams.map((ex) => (
          <div key={ex.id} className="exam-list-row">
            <div className="exam-list-row-main">
              <div className="exam-list-title">{ex.title}</div>
              <div className="exam-list-meta">Closed {fmtDateTime(ex.end_time)}</div>
            </div>
            <button className="btn-primary" onClick={() => onOpen(ex)}>View merit list</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeritTable({ exam, onBack }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Ensure ranks are computed (idempotent, no-op if window still open —
      // it won't be, since this page only opens for closed exams).
      await supabase.rpc('compute_exam_ranks', { target_exam_id: exam.id });

      const { data } = await supabase
        .from('exam_attempts')
        .select('*, profiles(full_name, username)')
        .eq('exam_id', exam.id)
        .eq('attempt_type', 'official')
        .eq('status', 'submitted')
        .order('rank', { ascending: true, nullsFirst: false });
      if (cancelled) return;
      setRows(data || []);
    }
    load();
    return () => { cancelled = true; };
  }, [exam.id]);

  if (rows === null) return <div className="panel"><p className="muted">Loading merit list…</p></div>;

  return (
    <div className="panel">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Exams</button>
      <h2>{exam.title}</h2>
      <p className="muted small">{rows.length} student{rows.length !== 1 ? 's' : ''} attempted this exam.</p>

      <div className="merit-table-wrap">
        {rows.map((r) => {
          const isMe = r.examinee_id === user.id;
          return (
            <div key={r.id} className={isMe ? 'merit-row merit-row-mine' : 'merit-row'}>
              <div className="merit-rank">#{r.rank ?? '—'}</div>
              <div className="merit-name">
                {r.profiles?.full_name || 'Student'}
                {isMe && <span className="merit-you-tag">You</span>}
              </div>
              <div className="merit-score">{r.percentage}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MeritListPage() {
  const [category, setCategory] = useState(null);
  const [exam, setExam] = useState(null);

  if (exam) return <MeritTable exam={exam} onBack={() => setExam(null)} />;
  if (category) return <ClosedExamList category={category} onBack={() => setCategory(null)} onOpen={setExam} />;
  return <CategoryPicker onPick={setCategory} />;
}

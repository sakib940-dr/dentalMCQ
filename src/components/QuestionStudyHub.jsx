import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useAppSetting, LockedFeature } from './FeatureLock';
import { PracticeSession } from './PracticePage';
import { loadBookmarkedIds, addBookmark, removeBookmark } from '../lib/bookmarks';
import { loadReadIds, markRead, markUnread, markManyRead, markManyUnread } from '../lib/readMarks';
import { IconArrowLeft, IconArrowRight, IconHeart, IconCheck } from '../lib/examineeIcons';

const PAGE_SIZE = 50;

// ============================================================
// Progress ring — small SVG circle, no extra dependency
// ============================================================
function ProgressRing({ percent, label }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;
  return (
    <div className="study-ring-wrap">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} strokeWidth="5" fill="none" style={{ stroke: '#E7E3D8' }} />
        <circle
          cx="32" cy="32" r={r} strokeWidth="5" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 32 32)"
          style={{ stroke: 'var(--teal)', transition: 'stroke-dashoffset 0.3s' }}
        />
      </svg>
      <div className="study-ring-label">{label}</div>
    </div>
  );
}

// ============================================================
// Subject card — mirrors the category-picker card pattern, but at the
// subject level: progress ring, subtopic/question counts, and the three
// entry points (All Questions / All Subtopics / Random Quiz).
// ============================================================
function SubjectStudyCard({ subject, onOpenAllQuestions, onOpenSubtopics, onStartQuiz }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: subcats } = await supabase.from('subcategories').select('id').eq('subject_id', subject.id);
      const subcatIds = (subcats || []).map((s) => s.id);
      const { data: chaps } = subcatIds.length
        ? await supabase.from('chapters').select('id').in('subcategory_id', subcatIds)
        : { data: [] };
      const chapterIds = (chaps || []).map((c) => c.id);

      if (chapterIds.length === 0) {
        if (!cancelled) setStats({ total: 0, read: 0, subtopics: subcatIds.length, hearts: 0, chapterIds: [] });
        return;
      }

      const [{ data: progressRows }, { data: heartCount }] = await Promise.all([
        supabase.rpc('get_subject_study_progress', { p_examinee_id: user.id, p_chapter_ids: chapterIds }),
        supabase.rpc('get_subject_bookmark_count', { p_examinee_id: user.id, p_chapter_ids: chapterIds }),
      ]);
      if (cancelled) return;
      const row = (progressRows && progressRows[0]) || { total_questions: 0, read_questions: 0 };
      setStats({
        total: Number(row.total_questions) || 0,
        read: Number(row.read_questions) || 0,
        subtopics: subcatIds.length,
        hearts: Number(heartCount) || 0,
        chapterIds,
      });
    }
    load();
    return () => { cancelled = true; };
  }, [subject.id, user.id]);

  const percent = stats && stats.total > 0 ? (stats.read / stats.total) * 100 : 0;

  return (
    <div className="panel study-subject-card">
      <div className="study-subject-header">
        <div className="study-subject-name">{subject.name}</div>
        <div className="study-subject-hearts" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconHeart size={13} fill="currentColor" /> {stats ? stats.hearts : '…'}</div>
      </div>

      <div className="study-subject-body">
        <ProgressRing
          percent={percent}
          label={stats ? `${stats.read}/${stats.total > 999 ? `${(stats.total / 1000).toFixed(1)}K` : stats.total}` : '…'}
        />
        <div className="study-subject-meta">
          <div>{stats ? percent.toFixed(2) : '0.00'}% প্রশ্ন পড়া হয়েছে</div>
          <div className="muted small">Subtopics: {stats ? stats.subtopics : '…'}</div>
          <div className="muted small">Questions: {stats ? stats.total : '…'}</div>
        </div>
      </div>

      <div className="study-subject-actions">
        <button className="btn-secondary sm" disabled={!stats} onClick={() => onOpenAllQuestions(subject, stats)}>All Questions</button>
        <button className="btn-secondary sm" disabled={!stats} onClick={() => onOpenSubtopics(subject, stats)}>All Subtopics</button>
        <button className="btn-secondary sm" disabled={!stats || stats.total === 0} onClick={() => onStartQuiz(subject, stats)}>Random Quiz</button>
      </div>
    </div>
  );
}

// ============================================================
// Subtopic list — "All Subtopics" drill-down. Selecting one shows only
// that subtopic's questions (flattened across its chapters).
// ============================================================
function SubtopicList({ subject, onBack, onOpenSubtopic }) {
  const [subcats, setSubcats] = useState(null);

  useEffect(() => {
    supabase.from('subcategories').select('id, name').eq('subject_id', subject.id).order('display_order')
      .then(async ({ data }) => {
        const withCounts = await Promise.all((data || []).map(async (sc) => {
          const { data: chaps } = await supabase.from('chapters').select('id').eq('subcategory_id', sc.id);
          const chapterIds = (chaps || []).map((c) => c.id);
          const { count } = chapterIds.length
            ? await supabase.from('questions').select('id', { count: 'exact', head: true }).in('chapter_id', chapterIds).eq('is_active', true)
            : { count: 0 };
          return { ...sc, chapterIds, questionCount: count || 0 };
        }));
        setSubcats(withCounts);
      });
  }, [subject.id]);

  return (
    <div className="panel">
      <button className="btn-secondary sm" onClick={onBack} style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconArrowLeft size={14} /> {subject.name}</button>
      <h2>{subject.name} — Subtopics</h2>
      {subcats === null && <p className="muted small">Loading…</p>}
      {subcats && subcats.length === 0 && <p className="muted small">No subtopics found.</p>}
      <div className="recent-list">
        {(subcats || []).map((sc) => (
          <button key={sc.id} className="recent-row study-subtopic-row" onClick={() => onOpenSubtopic(sc)}>
            <span className="recent-name">{sc.name}</span>
            <span className="muted small">{sc.questionCount} questions</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Question study list — the actual read/study view (paginated).
// Read-only options (no answer selection), with per-question controls:
// read/unread checkbox, reveal answer, reveal explanation, bookmark.
// ============================================================
function QuestionStudyList({ title, chapterIds, onBack }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [readIds, setReadIds] = useState(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [revealed, setRevealed] = useState({}); // { [questionId]: { answer: bool, explanation: bool } }

  useEffect(() => { setPage(1); }, [chapterIds]);

  useEffect(() => {
    if (!chapterIds || chapterIds.length === 0) { setQuestions([]); setTotal(0); return; }
    let cancelled = false;
    async function load() {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const [{ data, count }] = await Promise.all([
        supabase.from('questions').select('*', { count: 'exact' }).in('chapter_id', chapterIds).eq('is_active', true).order('id').range(from, to),
      ]);
      if (cancelled) return;
      const qs = data || [];
      setQuestions(qs);
      setTotal(count || 0);
      const ids = qs.map((q) => q.id);
      const [read, bm] = await Promise.all([loadReadIds(user.id, ids), loadBookmarkedIds(user.id, ids)]);
      if (cancelled) return;
      setReadIds(read);
      setBookmarkedIds(bm);
      setRevealed({});
    }
    load();
    return () => { cancelled = true; };
  }, [chapterIds, page, user.id]);

  const totalPages = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  const toggleRead = (qId) => {
    const isRead = readIds.has(qId);
    setReadIds((s) => { const n = new Set(s); isRead ? n.delete(qId) : n.add(qId); return n; });
    isRead ? markUnread(user.id, qId) : markRead(user.id, qId);
  };

  const toggleBookmark = (qId) => {
    const isBm = bookmarkedIds.has(qId);
    setBookmarkedIds((s) => { const n = new Set(s); isBm ? n.delete(qId) : n.add(qId); return n; });
    isBm ? removeBookmark(user.id, qId) : addBookmark(user.id, qId);
  };

  const toggleReveal = (qId, key) => {
    setRevealed((r) => ({ ...r, [qId]: { ...r[qId], [key]: !r[qId]?.[key] } }));
  };

  const markAllRead = async () => {
    const ids = (questions || []).map((q) => q.id);
    setReadIds((s) => new Set([...s, ...ids]));
    await markManyRead(user.id, ids);
  };
  const markAllUnread = async () => {
    const ids = (questions || []).map((q) => q.id);
    setReadIds((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    await markManyUnread(user.id, ids);
  };

  return (
    <div className="panel">
      <button className="btn-secondary sm" onClick={onBack} style={{ marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconArrowLeft size={14} /> ফিরে যান</button>

      <div className="study-list-header">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="study-list-page-control">
          <span>Page</span>
          <input
            type="number" min={1} max={totalPages} value={page}
            onChange={(e) => setPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))}
          />
          <span>of {totalPages}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
        <button className="btn-secondary sm" onClick={markAllRead}>Mark all as read (এই পেজ)</button>
        <button className="btn-secondary sm" onClick={markAllUnread}>Mark all as unread (এই পেজ)</button>
      </div>

      {questions === null && <p className="muted small">Loading…</p>}

      {(questions || []).map((q, idx) => {
        const isRead = readIds.has(q.id);
        const isBm = bookmarkedIds.has(q.id);
        const rev = revealed[q.id] || {};
        const globalNum = (page - 1) * PAGE_SIZE + idx + 1;
        return (
          <div key={q.id} className={`study-question-card${isRead ? ' study-question-read' : ''}`}>
            <div className="study-question-top">
              <span className="q-num-label">Question {globalNum}</span>
              <input type="checkbox" checked={isRead} onChange={() => toggleRead(q.id)} title="পড়া হয়েছে হিসেবে চিহ্নিত করুন" />
            </div>
            <div className="q-text">{q.question_text}</div>
            <div className="opt-list">
              {['A', 'B', 'C', 'D'].map((letter) => {
                const isCorrectOpt = rev.answer && letter === q.correct_option;
                let cls = 'opt-btn opt-static';
                if (isCorrectOpt) cls += ' opt-correct';
                return (
                  <div key={letter} className={cls}>
                    <span className="opt-letter">{letter}</span>
                    <span className="opt-text">{q[`option_${letter.toLowerCase()}`]}</span>
                    {isCorrectOpt && <span className="opt-tag-correct" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={13} /> correct</span>}
                  </div>
                );
              })}
            </div>
            {rev.explanation && q.explanation && (
              <div className="expl-box"><b>ব্যাখ্যা:</b> {q.explanation}</div>
            )}
            <div className="study-question-actions">
              <button className="btn-secondary sm" onClick={() => toggleReveal(q.id, 'answer')}>{rev.answer ? 'উত্তর লুকান' : 'উত্তর দেখুন'}</button>
              <button className="btn-secondary sm" onClick={() => toggleReveal(q.id, 'explanation')} disabled={!q.explanation}>ব্যাখ্যা</button>
              <button className={isBm ? 'btn-secondary sm study-heart-active' : 'btn-secondary sm'} onClick={() => toggleBookmark(q.id)}>{isBm ? <IconHeart size={14} fill="currentColor" /> : <IconHeart size={14} />}</button>
            </div>
          </div>
        );
      })}

      {questions && questions.length === 0 && <p className="muted small">কোনো প্রশ্ন পাওয়া যায়নি।</p>}

      <div className="study-list-page-control" style={{ marginTop: 14, justifyContent: 'center' }}>
        <button className="btn-secondary sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconArrowLeft size={14} /> আগের পেজ</button>
        <span className="muted small">Page {page} of {totalPages}</span>
        <button className="btn-secondary sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>পরের পেজ <IconArrowRight size={14} /></button>
      </div>
    </div>
  );
}

// ============================================================
// Main hub — category picker → subject cards → (questions | subtopics | quiz)
// ============================================================
export default function QuestionStudyHub() {
  const { user } = useAuth();
  const [categories, setCategories] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [view, setView] = useState(null); // { type: 'questions'|'subtopics', subject, chapterIds?, title? }
  const [quizSession, setQuizSession] = useState(null);
  const { value: globalPracticeOn, loading: gateLoading } = useAppSetting('practice_enabled_global', true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const now = new Date();
      const { data: grants } = await supabase
        .from('category_access_grants')
        .select('category_id, expires_at')
        .eq('examinee_id', user.id)
        .not('category_id', 'is', null);
      const activeCategoryIds = [...new Set((grants || [])
        .filter((g) => !g.expires_at || new Date(g.expires_at) > now)
        .map((g) => g.category_id))];
      if (activeCategoryIds.length === 0) { if (!cancelled) setCategories([]); return; }
      const { data: cats } = await supabase.from('categories').select('id, name').in('id', activeCategoryIds).eq('is_active', true).order('display_order');
      if (!cancelled) setCategories(cats || []);
    }
    load();
    return () => { cancelled = true; };
  }, [user.id]);

  const [subjects, setSubjects] = useState(null);
  useEffect(() => {
    if (!activeCategory) { setSubjects(null); return; }
    supabase.from('subjects').select('id, name').eq('category_id', activeCategory.id).order('display_order')
      .then(({ data }) => setSubjects(data || []));
  }, [activeCategory]);

  if (gateLoading) return null;
  if (!globalPracticeOn) return <LockedFeature />;

  if (quizSession) {
    return <PracticeSession session={quizSession} onExit={() => setQuizSession(null)} />;
  }

  if (view?.type === 'questions') {
    return <QuestionStudyList title={view.title} chapterIds={view.chapterIds} onBack={() => setView(null)} />;
  }

  if (view?.type === 'subtopics') {
    return (
      <SubtopicList
        subject={view.subject}
        onBack={() => setView(null)}
        onOpenSubtopic={(sc) => setView({ type: 'questions', chapterIds: sc.chapterIds, title: `${view.subject.name} — ${sc.name}` })}
      />
    );
  }

  if (activeCategory) {
    return (
      <div>
        <button className="btn-secondary sm" onClick={() => setActiveCategory(null)} style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconArrowLeft size={14} /> সব ক্যাটাগরি</button>
        {subjects === null && <p className="muted small">Loading subjects…</p>}
        {subjects && subjects.length === 0 && <p className="muted small">No subjects found in this category.</p>}
        <div className="study-subject-grid">
          {(subjects || []).map((s) => (
            <SubjectStudyCard
              key={s.id}
              subject={s}
              onOpenAllQuestions={(subject, stats) => setView({ type: 'questions', chapterIds: stats.chapterIds, title: `${subject.name} — All Questions`, subject })}
              onOpenSubtopics={(subject) => setView({ type: 'subtopics', subject })}
              onStartQuiz={(subject, stats) => {
                const count = Math.min(20, stats.total);
                setQuizSession({
                  mode: 'mixed',
                  subjectPicks: [{ subjectId: subject.id, count }],
                  minutes: Math.max(1, Math.round(count * 0.6)),
                });
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>প্রশ্নব্যাংক — পড়ুন / স্টাডি করুন</h2>
      <p className="muted small">যেকোনো প্রশ্ন পড়ুন, উত্তর ও ব্যাখ্যা দেখুন, পড়া হয়েছে চিহ্নিত করুন, পছন্দের প্রশ্ন সেভ করুন — কুইজ শুরু না করেই।</p>
      {categories === null && <p className="muted small">Loading…</p>}
      {categories && categories.length === 0 && <p className="muted">No active subscriptions yet.</p>}
      <div className="category-pick-grid qbp-grid">
        {(categories || []).map((c) => (
          <button key={c.id} className="category-pick-card qbp-category-card" onClick={() => setActiveCategory(c)}>
            <div className="qbp-category-name">{c.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

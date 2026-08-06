import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useAppSetting, LockedFeature } from './FeatureLock';
import { PracticeSetup, PracticeSession, findResumablePracticeSession } from './PracticePage';

function CategoryProgressCard({ category, onPick }) {
  return (
    <button className="category-pick-card qbp-category-card" onClick={() => onPick(category)}>
      <div className="qbp-category-name">{category.name}</div>
      <div className="qbp-category-stats">
        {category.questionCount} question{category.questionCount !== 1 ? 's' : ''}
        {category.toReview > 0 && <span className="qbp-category-toreview"> · {category.toReview} to review</span>}
      </div>
    </button>
  );
}

export default function QuestionBankPracticePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [session, setSession] = useState(null);
  const [checkedResume, setCheckedResume] = useState(false);
  const { value: globalPracticeOn, loading: gateLoading } = useAppSetting('practice_enabled_global', true);

  // Auto-resume any in-progress session — this preserves the old "Continue
  // Practice" convenience, just under this clearer, more capable entry point.
  useEffect(() => {
    if (checkedResume) return;
    const resumable = findResumablePracticeSession();
    if (resumable) setSession(resumable);
    setCheckedResume(true);
  }, [checkedResume]);

  useEffect(() => {
    if (!checkedResume || session) return;
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

      const { data: cats } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', activeCategoryIds)
        .eq('is_active', true)
        .order('display_order');

      // Per-category question counts + "to review" counts, computed cheaply:
      // wrong_questions is bounded by the student's own list (self-limiting,
      // never large), so mapping it to categories via each question's chapter
      // is cheap — no need to pull the full question bank per category.
      const { data: subjects } = await supabase.from('subjects').select('id, category_id').in('category_id', activeCategoryIds);
      const subjectToCategory = new Map((subjects || []).map((s) => [s.id, s.category_id]));
      const subjectIds = (subjects || []).map((s) => s.id);

      const { data: subcats } = subjectIds.length
        ? await supabase.from('subcategories').select('id, subject_id').in('subject_id', subjectIds)
        : { data: [] };
      const subcatToCategory = new Map((subcats || []).map((sc) => [sc.id, subjectToCategory.get(sc.subject_id)]));
      const subcatIds = (subcats || []).map((sc) => sc.id);

      const { data: chaps } = subcatIds.length
        ? await supabase.from('chapters').select('id, subcategory_id').in('subcategory_id', subcatIds)
        : { data: [] };
      const chapterToCategory = new Map((chaps || []).map((c) => [c.id, subcatToCategory.get(c.subcategory_id)]));
      const chapIdsByCategory = {};
      (chaps || []).forEach((c) => {
        const catId = subcatToCategory.get(c.subcategory_id);
        if (!catId) return;
        (chapIdsByCategory[catId] ||= []).push(c.id);
      });

      // One exact count per category, not a row fetch + client-side bucket:
      // a plain .select() response is silently capped at Supabase's default
      // 1000-row limit, which under-counted any category with 1000+
      // questions. { count: 'exact', head: true } returns just the number
      // via a HEAD request and isn't subject to that row cap.
      const countByCategory = {};
      await Promise.all(
        Object.entries(chapIdsByCategory).map(async ([catId, catChapIds]) => {
          const { count } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .in('chapter_id', catChapIds)
            .eq('is_active', true);
          countByCategory[catId] = count || 0;
        })
      );

      const { data: wrongRows } = await supabase
        .from('wrong_questions')
        .select('question_id, questions(chapter_id)')
        .eq('examinee_id', user.id)
        .eq('mastered', false);
      const toReviewByCategory = {};
      (wrongRows || []).forEach((w) => {
        const catId = chapterToCategory.get(w.questions?.chapter_id);
        if (catId) toReviewByCategory[catId] = (toReviewByCategory[catId] || 0) + 1;
      });

      if (cancelled) return;
      setCategories((cats || []).map((c) => ({
        ...c,
        questionCount: countByCategory[c.id] || 0,
        toReview: toReviewByCategory[c.id] || 0,
      })));
    }
    load();
    return () => { cancelled = true; };
  }, [user.id, checkedResume, session]);

  if (gateLoading || !checkedResume) return null;
  if (!globalPracticeOn) return <LockedFeature />;
  if (profile && profile.practice_enabled === false) {
    return (
      <div className="panel">
        <h2>Practice mode</h2>
        <p className="muted">
          Practice mode has been disabled for your account by an administrator. Contact them via
          the Notice Board or your exam coordinator if you believe this is a mistake.
        </p>
      </div>
    );
  }

  if (session) {
    return <PracticeSession session={session} onExit={() => { setSession(null); setActiveCategory(null); }} />;
  }

  if (activeCategory) {
    return (
      <>
        <button className="btn-secondary" onClick={() => setActiveCategory(null)} style={{ marginBottom: 12 }}>← All categories</button>
        <PracticeSetup categoryId={activeCategory.id} onPick={setSession} />
      </>
    );
  }

  if (categories === null) return <div className="panel"><p className="muted">Loading your categories…</p></div>;

  return (
    <div className="panel">
      <h2>Question Bank Practice</h2>
      <p className="muted small">Practice by subject, chapter, mixed, or random — unlimited, scoped to your active subscriptions.</p>
      {categories.length === 0 ? (
        <div className="muted">
          No active subscriptions yet.
          <button className="btn-primary sm" style={{ marginLeft: 8 }} onClick={() => navigate('/dashboard/package')}>Browse Packages</button>
        </div>
      ) : (
        <div className="category-pick-grid qbp-grid">
          {categories.map((c) => <CategoryProgressCard key={c.id} category={c} onPick={setActiveCategory} />)}
        </div>
      )}
    </div>
  );
}

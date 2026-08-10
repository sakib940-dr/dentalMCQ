import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { IconCheck } from '../lib/examineeIcons';

function highlight(text, term) {
  if (!text || !term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function ResultCard({ q, term }) {
  return (
    <div className="panel answer-sheet-card">
      <div className="q-text">{highlight(q.question_text, term)}</div>
      <div className="opt-list">
        {['A', 'B', 'C', 'D'].map((letter) => {
          const isCorrectOpt = letter === q.correct_option;
          return (
            <div key={letter} className={isCorrectOpt ? 'opt-btn opt-static opt-correct' : 'opt-btn opt-static'}>
              <span className="opt-letter">{letter}</span>
              <span className="opt-text">{highlight(q[`option_${letter.toLowerCase()}`], term)}</span>
              {isCorrectOpt && <span className="opt-tag-correct" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={13} /> correct</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SmartSearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState('');
  // Derived, not separate state: search() sets searched+results together
  // at the start of every attempt (first or repeat), so this is true for
  // exactly the duration of the fetch, with nothing extra to keep in sync.
  const searching = searched !== '' && results === null;

  const search = async (e) => {
    e?.preventDefault();
    const term = query.trim();
    if (term.length < 2) return;
    setResults(null);
    setSearched(term);

    // Only search within categories the student currently has active
    // access to — Smart Search doesn't bypass the subscription model.
    const now = new Date();
    const { data: grants } = await supabase
      .from('category_access_grants')
      .select('category_id, expires_at')
      .eq('examinee_id', user.id)
      .not('category_id', 'is', null);
    const activeCategoryIds = [...new Set((grants || [])
      .filter((g) => !g.expires_at || new Date(g.expires_at) > now)
      .map((g) => g.category_id))];

    if (activeCategoryIds.length === 0) { setResults([]); return; }

    const { data: subjects } = await supabase.from('subjects').select('id').in('category_id', activeCategoryIds);
    const subjectIds = (subjects || []).map((s) => s.id);
    if (subjectIds.length === 0) { setResults([]); return; }
    const { data: subcats } = await supabase.from('subcategories').select('id').in('subject_id', subjectIds);
    const subcatIds = (subcats || []).map((s) => s.id);
    if (subcatIds.length === 0) { setResults([]); return; }
    const { data: chaps } = await supabase.from('chapters').select('id').in('subcategory_id', subcatIds);
    const chapIds = (chaps || []).map((c) => c.id);
    if (chapIds.length === 0) { setResults([]); return; }

    // Five separate safe ilike queries (one per field) merged client-side,
    // rather than one raw .or() filter string — embedding a user-typed
    // search term into a PostgREST .or() string breaks on commas and
    // parentheses, which medical terms can easily contain.
    const fields = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d'];
    const pattern = `%${term}%`;
    const queries = fields.map((f) =>
      supabase.from('questions').select('*').in('chapter_id', chapIds).eq('is_active', true).ilike(f, pattern).limit(30)
    );
    const responses = await Promise.all(queries);

    const byId = new Map();
    responses.forEach((r) => { (r.data || []).forEach((q) => byId.set(q.id, q)); });
    setResults([...byId.values()].slice(0, 40));
  };

  const practiceResults = () => {
    const ids = (results || []).map((q) => q.id);
    navigate('/dashboard/practice-session', { state: { session: { mode: 'idList', ids } } });
  };

  return (
    <div className="panel">
      <h2>Smart Search</h2>
      <p className="muted small">Search question text and answer options across your subscribed categories.</p>

      <form className="inline-add-form" onSubmit={search} style={{ marginTop: 10 }}>
        <input
          placeholder="e.g. Amalgam"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button className="btn-primary sm" type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searching && <p className="muted small" style={{ marginTop: 10 }}>Searching…</p>}

      {!searching && results !== null && (
        <p className="muted small" style={{ marginTop: 10 }}>
          {results.length} result{results.length !== 1 ? 's' : ''} for "{searched}"
          {results.length > 0 && (
            <button className="btn-secondary sm" style={{ marginLeft: 8 }} onClick={practiceResults}>
              Practice these
            </button>
          )}
        </p>
      )}

      {!searching && results !== null && results.length === 0 && (
        <p className="muted small">No matches found in your subscribed categories.</p>
      )}

      <div className="answer-sheet-list" style={{ marginTop: 10 }}>
        {(results || []).map((q) => <ResultCard key={q.id} q={q} term={searched} />)}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function InlineAddForm({ placeholder, onAdd }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    await onAdd(value.trim());
    setSaving(false);
    setValue('');
  };

  return (
    <form className="inline-add-form" onSubmit={submit}>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      <button type="submit" className="btn-secondary" disabled={saving}>{saving ? '…' : '+ Add'}</button>
    </form>
  );
}

function TreeRow({ name, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  const save = async () => {
    setEditing(false);
    if (value.trim() && value.trim() !== name) await onRename(value.trim());
  };

  return (
    <div className={active ? 'tree-row tree-row-active' : 'tree-row'}>
      {editing ? (
        <input
          className="tree-row-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button className="tree-row-select" onClick={onSelect}>
          <span className="tree-row-name">{name}</span>
          {onSelect && <span className="tree-row-arrow">{active ? '▾ managing' : '▸ manage'}</span>}
        </button>
      )}
      <div className="tree-row-actions">
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setValue(name); setEditing(true); }} title="Rename">✎</button>
        {onDelete && (
          <button className="icon-btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">✕</button>
        )}
      </div>
    </div>
  );
}

function ChaptersPanel({ subcategoryId, subcategoryName, hideDelete }) {
  const [chapters, setChapters] = useState([]);

  const load = useCallback(async () => {
    if (!subcategoryId) { setChapters([]); return; }
    const { data } = await supabase.from('chapters').select('*').eq('subcategory_id', subcategoryId).order('display_order');
    setChapters(data || []);
  }, [subcategoryId]);

  useEffect(() => { load(); }, [load]);

  if (!subcategoryId) return null;

  return (
    <div className="tree-panel tree-panel-nested">
      <div className="tree-panel-title">Chapters in "{subcategoryName}"</div>
      {chapters.length === 0 && <div className="tree-empty">No chapters yet — add the first one below.</div>}
      {chapters.map((c) => (
        <TreeRow
          key={c.id}
          name={c.name}
          onRename={async (name) => { await supabase.from('chapters').update({ name }).eq('id', c.id); load(); }}
          onDelete={hideDelete ? null : async () => {
            if (!confirm(`Delete chapter "${c.name}"? Questions inside it will also be deleted.`)) return;
            await supabase.from('chapters').delete().eq('id', c.id);
            load();
          }}
        />
      ))}
      <InlineAddForm
        placeholder="New chapter name"
        onAdd={async (name) => {
          await supabase.from('chapters').insert({ subcategory_id: subcategoryId, name, display_order: chapters.length });
          load();
        }}
      />
    </div>
  );
}

function SubcategoriesPanel({ subjectId, subjectName, selected, onSelect, hideDelete }) {
  const [subcategories, setSubcategories] = useState([]);

  const load = useCallback(async () => {
    if (!subjectId) { setSubcategories([]); return; }
    const { data } = await supabase.from('subcategories').select('*').eq('subject_id', subjectId).order('display_order');
    setSubcategories(data || []);
  }, [subjectId]);

  useEffect(() => { load(); }, [load]);

  if (!subjectId) return null;

  return (
    <div className="tree-panel tree-panel-nested">
      <div className="tree-panel-title">Sub-categories in "{subjectName}"</div>
      {subcategories.length === 0 && <div className="tree-empty">No sub-categories yet — add the first one below.</div>}
      {subcategories.map((s) => (
        <TreeRow
          key={s.id}
          name={s.name}
          active={selected === s.id}
          onSelect={() => onSelect(selected === s.id ? null : { id: s.id, name: s.name })}
          onRename={async (name) => { await supabase.from('subcategories').update({ name }).eq('id', s.id); load(); }}
          onDelete={hideDelete ? null : async () => {
            if (!confirm(`Delete sub-category "${s.name}"? Its chapters and questions will also be deleted.`)) return;
            await supabase.from('subcategories').delete().eq('id', s.id);
            if (selected === s.id) onSelect(null);
            load();
          }}
        />
      ))}
      <InlineAddForm
        placeholder="New sub-category name"
        onAdd={async (name) => {
          await supabase.from('subcategories').insert({ subject_id: subjectId, name, display_order: subcategories.length });
          load();
        }}
      />
    </div>
  );
}

function SubjectsPanel({ categoryId, categoryName, selected, onSelect, hideDelete }) {
  const [subjects, setSubjects] = useState([]);

  const load = useCallback(async () => {
    if (!categoryId) { setSubjects([]); return; }
    const { data } = await supabase.from('subjects').select('*').eq('category_id', categoryId).order('display_order');
    setSubjects(data || []);
  }, [categoryId]);

  useEffect(() => { load(); }, [load]);

  if (!categoryId) return null;

  return (
    <div className="tree-panel tree-panel-nested">
      <div className="tree-panel-title">Subjects in "{categoryName}"</div>
      {subjects.length === 0 && <div className="tree-empty">No subjects yet — add the first one below.</div>}
      {subjects.map((s) => (
        <TreeRow
          key={s.id}
          name={s.name}
          active={selected === s.id}
          onSelect={() => onSelect(selected === s.id ? null : { id: s.id, name: s.name })}
          onRename={async (name) => { await supabase.from('subjects').update({ name }).eq('id', s.id); load(); }}
          onDelete={hideDelete ? null : async () => {
            if (!confirm(`Delete subject "${s.name}"? Everything inside it will also be deleted.`)) return;
            await supabase.from('subjects').delete().eq('id', s.id);
            if (selected === s.id) onSelect(null);
            load();
          }}
        />
      ))}
      <InlineAddForm
        placeholder="New subject name"
        onAdd={async (name) => {
          await supabase.from('subjects').insert({ category_id: categoryId, name, display_order: subjects.length });
          load();
        }}
      />
    </div>
  );
}

export default function CategoriesPage({ hideDelete }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // { id, name }
  const [selectedSubject, setSelectedSubject] = useState(null); // { id, name }
  const [selectedSubcategory, setSelectedSubcategory] = useState(null); // { id, name }

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('display_order');
    setCategories(data || []);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const selectCategory = (cat) => {
    setSelectedCategory((prev) => (prev?.id === cat.id ? null : cat));
    setSelectedSubject(null);
    setSelectedSubcategory(null);
  };

  return (
    <div className="panel">
      <h2>Exam Categories</h2>
      <p className="muted small">
        Create folders like "Dubai Licence Exam" or "BDS Professional". Click a category's name
        to manage its Subjects, then click a Subject to manage its Sub-categories, then a
        Sub-category to manage its Chapters — where questions actually live.
        {hideDelete && ' As an Admin, you can create and edit but not delete.'}
      </p>

      <div className="tree-panel">
        <div className="tree-panel-title">Categories</div>
        {categories.length === 0 && <div className="tree-empty">No categories yet — add the first one below.</div>}
        {categories.map((c) => (
          <TreeRow
            key={c.id}
            name={c.name}
            active={selectedCategory?.id === c.id}
            onSelect={() => selectCategory(c)}
            onRename={async (name) => { await supabase.from('categories').update({ name, slug: slugify(name) }).eq('id', c.id); loadCategories(); }}
            onDelete={hideDelete ? null : async () => {
              if (!confirm(`Delete category "${c.name}"? Everything inside it will also be deleted.`)) return;
              await supabase.from('categories').delete().eq('id', c.id);
              if (selectedCategory?.id === c.id) { setSelectedCategory(null); setSelectedSubject(null); setSelectedSubcategory(null); }
              loadCategories();
            }}
          />
        ))}
        <InlineAddForm
          placeholder="New category name (e.g. Dubai Licence Exam)"
          onAdd={async (name) => {
            await supabase.from('categories').insert({ name, slug: slugify(name), display_order: categories.length });
            loadCategories();
          }}
        />
      </div>

      {selectedCategory && (
        <div className="tree-panel tree-panel-nested">
          <label className="mini-toggle">
            <input
              type="checkbox"
              checked={!!selectedCategory.requires_payment}
              onChange={async (e) => {
                await supabase.from('categories').update({ requires_payment: e.target.checked }).eq('id', selectedCategory.id);
                setSelectedCategory((c) => ({ ...c, requires_payment: e.target.checked }));
                loadCategories();
              }}
            />
            <span>Requires payment/package to access</span>
          </label>
        </div>
      )}

      <SubjectsPanel
        categoryId={selectedCategory?.id}
        categoryName={selectedCategory?.name}
        selected={selectedSubject?.id}
        onSelect={setSelectedSubject}
        hideDelete={hideDelete}
      />
      <SubcategoriesPanel
        subjectId={selectedSubject?.id}
        subjectName={selectedSubject?.name}
        selected={selectedSubcategory?.id}
        onSelect={setSelectedSubcategory}
        hideDelete={hideDelete}
      />
      <ChaptersPanel
        subcategoryId={selectedSubcategory?.id}
        subcategoryName={selectedSubcategory?.name}
        hideDelete={hideDelete}
      />
    </div>
  );
}

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
      <button type="submit" className="btn-secondary" disabled={saving}>{saving ? '…' : 'Add'}</button>
    </form>
  );
}

function EditableRow({ name, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  const save = async () => {
    if (value.trim() && value.trim() !== name) await onRename(value.trim());
    setEditing(false);
  };

  return (
    <div className="tree-row">
      {editing ? (
        <input
          className="tree-row-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          autoFocus
        />
      ) : (
        <span className="tree-row-name" onClick={() => setEditing(true)}>{name}</span>
      )}
      <button className="icon-btn-danger" onClick={onDelete} title="Delete">✕</button>
    </div>
  );
}

function ChaptersPanel({ subcategoryId }) {
  const [chapters, setChapters] = useState([]);

  const load = useCallback(async () => {
    if (!subcategoryId) { setChapters([]); return; }
    const { data } = await supabase.from('chapters').select('*').eq('subcategory_id', subcategoryId).order('display_order');
    setChapters(data || []);
  }, [subcategoryId]);

  useEffect(() => { load(); }, [load]);

  if (!subcategoryId) return null;

  return (
    <div className="tree-panel">
      <div className="tree-panel-title">Chapters</div>
      {chapters.map((c) => (
        <EditableRow
          key={c.id}
          name={c.name}
          onRename={async (name) => { await supabase.from('chapters').update({ name }).eq('id', c.id); load(); }}
          onDelete={async () => {
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

function SubcategoriesPanel({ subjectId, selected, onSelect }) {
  const [subcategories, setSubcategories] = useState([]);

  const load = useCallback(async () => {
    if (!subjectId) { setSubcategories([]); return; }
    const { data } = await supabase.from('subcategories').select('*').eq('subject_id', subjectId).order('display_order');
    setSubcategories(data || []);
  }, [subjectId]);

  useEffect(() => { load(); }, [load]);

  if (!subjectId) return null;

  return (
    <div className="tree-panel">
      <div className="tree-panel-title">Sub-categories</div>
      {subcategories.map((s) => (
        <div key={s.id} className={selected === s.id ? 'tree-item tree-item-active' : 'tree-item'}>
          <div onClick={() => onSelect(s.id)} className="tree-item-clickable">
            <EditableRow
              name={s.name}
              onRename={async (name) => { await supabase.from('subcategories').update({ name }).eq('id', s.id); load(); }}
              onDelete={async () => {
                if (!confirm(`Delete sub-category "${s.name}"? Its chapters and questions will also be deleted.`)) return;
                await supabase.from('subcategories').delete().eq('id', s.id);
                if (selected === s.id) onSelect(null);
                load();
              }}
            />
          </div>
        </div>
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

function SubjectsPanel({ categoryId, selected, onSelect }) {
  const [subjects, setSubjects] = useState([]);

  const load = useCallback(async () => {
    if (!categoryId) { setSubjects([]); return; }
    const { data } = await supabase.from('subjects').select('*').eq('category_id', categoryId).order('display_order');
    setSubjects(data || []);
  }, [categoryId]);

  useEffect(() => { load(); }, [load]);

  if (!categoryId) return null;

  return (
    <div className="tree-panel">
      <div className="tree-panel-title">Subjects</div>
      {subjects.map((s) => (
        <div key={s.id} className={selected === s.id ? 'tree-item tree-item-active' : 'tree-item'}>
          <div onClick={() => onSelect(s.id)} className="tree-item-clickable">
            <EditableRow
              name={s.name}
              onRename={async (name) => { await supabase.from('subjects').update({ name }).eq('id', s.id); load(); }}
              onDelete={async () => {
                if (!confirm(`Delete subject "${s.name}"? Everything inside it will also be deleted.`)) return;
                await supabase.from('subjects').delete().eq('id', s.id);
                if (selected === s.id) onSelect(null);
                load();
              }}
            />
          </div>
        </div>
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

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('display_order');
    setCategories(data || []);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  return (
    <div className="panel">
      <h2>Exam Categories</h2>
      <p className="muted small">
        Create folders like "Dubai Licence Exam" or "BDS Professional", then build out Subject →
        Sub-category → Chapter underneath each one.
      </p>

      <div className="tree-panel">
        <div className="tree-panel-title">Categories</div>
        {categories.map((c) => (
          <div key={c.id} className={selectedCategory === c.id ? 'tree-item tree-item-active' : 'tree-item'}>
            <div onClick={() => { setSelectedCategory(c.id); setSelectedSubject(null); setSelectedSubcategory(null); }} className="tree-item-clickable">
              <EditableRow
                name={c.name}
                onRename={async (name) => { await supabase.from('categories').update({ name, slug: slugify(name) }).eq('id', c.id); loadCategories(); }}
                onDelete={async () => {
                  if (!confirm(`Delete category "${c.name}"? Everything inside it will also be deleted.`)) return;
                  await supabase.from('categories').delete().eq('id', c.id);
                  if (selectedCategory === c.id) { setSelectedCategory(null); setSelectedSubject(null); setSelectedSubcategory(null); }
                  loadCategories();
                }}
              />
            </div>
          </div>
        ))}
        <InlineAddForm
          placeholder="New category name (e.g. Dubai Licence Exam)"
          onAdd={async (name) => {
            await supabase.from('categories').insert({ name, slug: slugify(name), display_order: categories.length });
            loadCategories();
          }}
        />
      </div>

      <SubjectsPanel categoryId={selectedCategory} selected={selectedSubject} onSelect={setSelectedSubject} />
      <SubcategoriesPanel subjectId={selectedSubject} selected={selectedSubcategory} onSelect={setSelectedSubcategory} />
      <ChaptersPanel subcategoryId={selectedSubcategory} />
    </div>
  );
}

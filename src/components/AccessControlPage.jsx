import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function AccessControlPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [locks, setLocks] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, username').eq('role', 'examinee').order('full_name').then(({ data }) => setStudents(data || []));
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  const loadLocks = useCallback(async () => {
    if (!studentId) { setLocks([]); return; }
    const { data } = await supabase.from('manual_category_locks').select('category_id').eq('examinee_id', studentId);
    setLocks((data || []).map((l) => l.category_id));
  }, [studentId]);

  useEffect(() => { loadLocks(); }, [loadLocks]);

  const toggleLock = async (categoryId) => {
    setSaving(true);
    if (locks.includes(categoryId)) {
      await supabase.from('manual_category_locks').delete().eq('examinee_id', studentId).eq('category_id', categoryId);
    } else {
      await supabase.from('manual_category_locks').insert({ examinee_id: studentId, category_id: categoryId, locked_by: user.id });
    }
    setSaving(false);
    loadLocks();
  };

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="panel">
      <h2>Access Control</h2>
      <p className="muted small">
        Manually lock specific categories (exams, practice) for a specific student — this
        overrides their free trial or paid access. Prescription is never affected here.
      </p>

      <label className="field-block" style={{ marginTop: 14 }}>
        <span>Student</span>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Select a student…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.username})</option>)}
        </select>
      </label>

      {studentId && (
        <>
          <h3 className="section-subtitle">Categories for {selectedStudent?.full_name}</h3>
          <div className="access-lock-list">
            {categories.map((c) => {
              const isLocked = locks.includes(c.id);
              return (
                <div key={c.id} className="access-lock-row">
                  <span className="access-lock-name">{c.name}</span>
                  <label className="mini-toggle">
                    <input type="checkbox" checked={!isLocked} disabled={saving} onChange={() => toggleLock(c.id)} />
                    <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
                  </label>
                </div>
              );
            })}
            {categories.length === 0 && <div className="muted small">No categories yet.</div>}
          </div>
        </>
      )}
    </div>
  );
}

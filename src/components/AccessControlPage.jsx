import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export default function AccessControlPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [locks, setLocks] = useState([]); // array of { resource_type, category_id }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, username').eq('role', 'examinee').order('full_name').then(({ data }) => setStudents(data || []));
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  const loadLocks = useCallback(async () => {
    if (!studentId) { setLocks([]); return; }
    const { data } = await supabase.from('manual_category_locks').select('resource_type, category_id').eq('examinee_id', studentId);
    setLocks(data || []);
  }, [studentId]);

  useEffect(() => { loadLocks(); }, [loadLocks]);

  const isLocked = (resourceType, categoryId) =>
    locks.some((l) => l.resource_type === resourceType && l.category_id === categoryId);

  const toggleLock = async (resourceType, categoryId) => {
    setSaving(true);
    if (isLocked(resourceType, categoryId)) {
      let q = supabase.from('manual_category_locks').delete().eq('examinee_id', studentId).eq('resource_type', resourceType);
      q = categoryId ? q.eq('category_id', categoryId) : q.is('category_id', null);
      await q;
    } else {
      await supabase.from('manual_category_locks').insert({
        examinee_id: studentId,
        category_id: categoryId,
        resource_type: resourceType,
        locked_by: user.id,
      });
    }
    setSaving(false);
    loadLocks();
  };

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="panel">
      <h2>Access Control</h2>
      <p className="muted small">
        Manually lock specific categories or prescription access for a specific student — this
        overrides their free trial or paid access.
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
          <h3 className="section-subtitle">Resources for {selectedStudent?.full_name}</h3>
          <div className="access-lock-list">
            <div className="access-lock-row">
              <span className="access-lock-name">Prescription</span>
              <label className="mini-toggle">
                <input
                  type="checkbox"
                  checked={!isLocked('prescription', null)}
                  disabled={saving}
                  onChange={() => toggleLock('prescription', null)}
                />
                <span>{isLocked('prescription', null) ? 'Locked' : 'Unlocked'}</span>
              </label>
            </div>
            {categories.map((c) => {
              const locked = isLocked('category', c.id);
              return (
                <div key={c.id} className="access-lock-row">
                  <span className="access-lock-name">{c.name}</span>
                  <label className="mini-toggle">
                    <input type="checkbox" checked={!locked} disabled={saving} onChange={() => toggleLock('category', c.id)} />
                    <span>{locked ? 'Locked' : 'Unlocked'}</span>
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

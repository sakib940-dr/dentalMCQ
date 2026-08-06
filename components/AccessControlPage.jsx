import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function AccessControlPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [locks, setLocks] = useState([]); // array of { resource_type, category_id }
  const [grants, setGrants] = useState([]); // array of { resource_type, category_id, expires_at }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, username').eq('role', 'examinee').order('full_name').then(({ data }) => setStudents(data || []));
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
  }, []);

  const loadStatus = useCallback(async () => {
    if (!studentId) { setLocks([]); setGrants([]); return; }
    const [{ data: lockData }, { data: grantData }] = await Promise.all([
      supabase.from('manual_category_locks').select('resource_type, category_id').eq('examinee_id', studentId),
      supabase.from('category_access_grants').select('resource_type, category_id, expires_at').eq('examinee_id', studentId),
    ]);
    setLocks(lockData || []);
    setGrants(grantData || []);
  }, [studentId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const isLocked = (resourceType, categoryId) =>
    locks.some((l) => l.resource_type === resourceType && l.category_id === categoryId);

  const findGrant = (resourceType, categoryId) =>
    grants.find((g) => g.resource_type === resourceType && g.category_id === categoryId);

  const toggleLock = async (resourceType, categoryId) => {
    setSaving(true);
    const wasLocked = isLocked(resourceType, categoryId);
    if (wasLocked) {
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
    await supabase.from('audit_log').insert({
      actor_id: user.id,
      action: wasLocked ? 'manual_unlock' : 'manual_lock',
      target_user_id: studentId,
      details: { resource_type: resourceType, category_id: categoryId },
    });
    setSaving(false);
    loadStatus();
  };

  // Explains WHY a resource is locked/unlocked right now. There are only
  // 3 possible states: manually locked, an active subscription grant,
  // or no access at all — no trial, no free-by-default category, no
  // global toggle. This directly mirrors what has_active_access() checks
  // server-side.
  const explainStatus = (resourceType, categoryId) => {
    if (isLocked(resourceType, categoryId)) return { label: 'Manually locked', tone: 'locked' };

    const grant = findGrant(resourceType, categoryId);
    if (grant) {
      const remaining = daysLeft(grant.expires_at);
      if (remaining > 0) return { label: `Active subscription (${remaining}d left)`, tone: 'active' };
      return { label: 'Subscription expired — needs renewal', tone: 'expired' };
    }

    return { label: 'No active subscription — locked', tone: 'expired' };
  };

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="panel">
      <h2>Access Control</h2>
      <p className="muted small">
        Every category and prescription is locked by default and stays locked until an active
        subscription grant exists. Use this page to manually override a student's access
        (force-lock even with an active subscription) or just see their current status.
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
            {(() => {
              const status = explainStatus('prescription', null);
              return (
                <div className="access-lock-row access-lock-row-detailed">
                  <div>
                    <span className="access-lock-name">Prescription</span>
                    <span className={`access-status-tag access-status-${status.tone}`}>{status.label}</span>
                  </div>
                  <label className="mini-toggle">
                    <input
                      type="checkbox"
                      checked={!isLocked('prescription', null)}
                      disabled={saving}
                      onChange={() => toggleLock('prescription', null)}
                    />
                    <span>{isLocked('prescription', null) ? 'Force-locked' : 'Normal'}</span>
                  </label>
                </div>
              );
            })()}
            {categories.map((c) => {
              const locked = isLocked('category', c.id);
              const status = explainStatus('category', c.id);
              return (
                <div key={c.id} className="access-lock-row access-lock-row-detailed">
                  <div>
                    <span className="access-lock-name">{c.name}</span>
                    <span className={`access-status-tag access-status-${status.tone}`}>{status.label}</span>
                  </div>
                  <label className="mini-toggle">
                    <input type="checkbox" checked={!locked} disabled={saving} onChange={() => toggleLock('category', c.id)} />
                    <span>{locked ? 'Force-locked' : 'Normal'}</span>
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

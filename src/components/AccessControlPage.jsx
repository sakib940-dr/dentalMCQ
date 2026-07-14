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
  const [trialInfo, setTrialInfo] = useState(null); // { trial_started_at }
  const [trialDays, setTrialDays] = useState(15);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, username').eq('role', 'examinee').order('full_name').then(({ data }) => setStudents(data || []));
    supabase.from('categories').select('*').order('display_order').then(({ data }) => setCategories(data || []));
    supabase.from('app_number_settings').select('value').eq('key', 'free_trial_days').maybeSingle().then(({ data }) => {
      if (data) setTrialDays(data.value);
    });
  }, []);

  const loadStatus = useCallback(async () => {
    if (!studentId) { setLocks([]); setGrants([]); setTrialInfo(null); return; }
    const [{ data: lockData }, { data: grantData }, { data: profileData }] = await Promise.all([
      supabase.from('manual_category_locks').select('resource_type, category_id').eq('examinee_id', studentId),
      supabase.from('category_access_grants').select('resource_type, category_id, expires_at').eq('examinee_id', studentId),
      supabase.from('profiles').select('trial_started_at').eq('id', studentId).single(),
    ]);
    setLocks(lockData || []);
    setGrants(grantData || []);
    setTrialInfo(profileData || null);
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

  // Explains WHY a resource is locked/unlocked right now — this is the
  // High-priority "access visibility" fix: instead of just Locked/
  // Unlocked, show the actual reason (manual lock, active grant, expired
  // grant, trial still running, trial expired, never used).
  const explainStatus = (resourceType, categoryId, requiresPayment) => {
    if (isLocked(resourceType, categoryId)) return { label: 'Manually locked', tone: 'locked' };

    const grant = findGrant(resourceType, categoryId);
    if (grant) {
      const remaining = daysLeft(grant.expires_at);
      if (remaining > 0) return { label: `Active (${remaining}d left, paid/claimed)`, tone: 'active' };
      return { label: 'Grant expired — needs renewal', tone: 'expired' };
    }

    if (requiresPayment === false) return { label: 'Free category — always open', tone: 'active' };

    if (!trialInfo?.trial_started_at) return { label: 'Trial not started yet (opens on first use)', tone: 'neutral' };

    const trialRemaining = trialDays - Math.floor((Date.now() - new Date(trialInfo.trial_started_at).getTime()) / (1000 * 60 * 60 * 24));
    if (trialRemaining > 0) return { label: `Trial active (${trialRemaining}d left)`, tone: 'active' };
    return { label: 'Trial expired — no payment on file', tone: 'expired' };
  };

  const selectedStudent = students.find((s) => s.id === studentId);

  return (
    <div className="panel">
      <h2>Access Control</h2>
      <p className="muted small">
        Manually lock specific categories or prescription access for a specific student — this
        overrides their free trial or paid access. The status next to each row explains their
        current access state.
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
              const status = explainStatus('prescription', null, true);
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
                    <span>{isLocked('prescription', null) ? 'Locked' : 'Unlocked'}</span>
                  </label>
                </div>
              );
            })()}
            {categories.map((c) => {
              const locked = isLocked('category', c.id);
              const status = explainStatus('category', c.id, c.requires_payment);
              return (
                <div key={c.id} className="access-lock-row access-lock-row-detailed">
                  <div>
                    <span className="access-lock-name">{c.name}</span>
                    <span className={`access-status-tag access-status-${status.tone}`}>{status.label}</span>
                  </div>
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

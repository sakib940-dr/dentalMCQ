import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fmtDate } from '../lib/formatters';

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', moderator: 'Moderator', examinee: 'Student' };

function RoleBadge({ role }) {
  return <span className={`role-badge role-badge-${role}`}>{ROLE_LABELS[role] || role}</span>;
}

// Profile fields the user fills in themselves (medical/professional info +
// the separate "Chamber Details" contact block shown on prescriptions) —
// distinct from the Chamber Management module's own data (patients/
// appointments/prescriptions), which is fetched separately below.
const PROFILE_FIELDS = [
  ['medical_college', 'Medical college'],
  ['session_year', 'Session'],
  ['hometown', 'Hometown'],
  ['bmdc_number', 'BMDC number'],
  ['degrees', 'Degrees'],
  ['designation', 'Designation'],
];
const CHAMBER_CONTACT_FIELDS = [
  ['chamber_name', 'Chamber name'],
  ['chamber_address', 'Chamber address'],
  ['chamber_mobile', 'Chamber mobile'],
  ['visit_time', 'Visit time'],
  ['day_off', 'Day off'],
];

function ResetPasswordForm({ user, onDone }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setSaving(true);
    const { data, error: invokeError } = await supabase.functions.invoke('admin-reset-password', {
      body: { target_user_id: user.id, new_password: newPassword },
    });
    setSaving(false);

    if (invokeError) { setError(`Could not reach the reset function: ${invokeError.message}`); return; }
    if (!data?.success) { setError(data?.error || 'Failed to reset password.'); return; }

    setSuccess(data.warning || 'Password reset successfully.');
    setNewPassword('');
    onDone();
  };

  if (!open) {
    return <button className="btn-secondary sm" onClick={() => setOpen(true)}>Reset Password</button>;
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 10 }}>
      <div className="compact-field-row">
        <span className="compact-field-label">New:</span>
        <input
          className="compact-field-input"
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min 6 chars)"
        />
      </div>
      {error && <div className="error-box" style={{ marginTop: 8 }}>{error}</div>}
      {success && <div className="ok-box" style={{ marginTop: 8 }}>{success}</div>}
      <div className="exam-setup-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn-secondary sm" onClick={() => { setOpen(false); setError(''); }}>Cancel</button>
        <button type="submit" className="btn-primary sm" disabled={saving}>{saving ? 'Resetting…' : 'Confirm reset'}</button>
      </div>
    </form>
  );
}

function UserDetailModal({ user, credentials, revealedPw, onTogglePw, onClose, onChangeRole, onTogglePractice, onToggleLiveExam, onDelete, onChanged }) {
  const [chamberStats, setChamberStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ count: patients }, { count: prescriptions }, { count: appointments }] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
        supabase.from('prescriptions').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('owner_id', user.id),
      ]);
      if (!cancelled) setChamberStats({ patients: patients || 0, prescriptions: prescriptions || 0, appointments: appointments || 0 });
    }
    load();
    return () => { cancelled = true; };
  }, [user.id]);

  const pw = credentials[user.id];
  const shown = !!revealedPw[user.id];
  const filledProfileFields = PROFILE_FIELDS.filter(([key]) => user[key]);
  const filledChamberFields = CHAMBER_CONTACT_FIELDS.filter(([key]) => user[key]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
        <div className="user-row-top">
          <div className="modal-title" style={{ marginBottom: 0 }}>{user.full_name}</div>
          <RoleBadge role={user.role} />
        </div>

        <div className="user-row-grid" style={{ marginTop: 12 }}>
          <div><span className="user-field-label">User ID</span><span className="user-field-value mono">{user.id}</span></div>
          <div><span className="user-field-label">Username</span><span className="user-field-value">{user.username}</span></div>
          <div><span className="user-field-label">Email</span><span className="user-field-value">{user.email || '—'}</span></div>
          <div><span className="user-field-label">Phone</span><span className="user-field-value">{user.mobile_number || '—'}</span></div>
          <div><span className="user-field-label">Joined</span><span className="user-field-value">{fmtDate(user.created_at)}</span></div>
          <div>
            <span className="user-field-label">Password</span>
            <span className="user-field-value mono">
              {pw ? (shown ? pw : '••••••••') : '—'}
              {pw && (
                <button className="pw-toggle" onClick={() => onTogglePw(user.id)}>
                  {shown ? 'hide' : 'show'}
                </button>
              )}
            </span>
          </div>
          <div>
            <span className="user-field-label">Practice mode</span>
            <label className="mini-toggle">
              <input type="checkbox" checked={user.practice_enabled} onChange={() => onTogglePractice(user)} />
              <span>{user.practice_enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
          <div>
            <span className="user-field-label">Live Exam</span>
            <label className="mini-toggle">
              <input type="checkbox" checked={user.live_exam_enabled} onChange={() => onToggleLiveExam(user)} />
              <span>{user.live_exam_enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
        </div>

        {filledProfileFields.length > 0 && (
          <div className="modal-detail-section">
            <h4>Profile information</h4>
            <div className="user-row-grid">
              {filledProfileFields.map(([key, label]) => (
                <div key={key}><span className="user-field-label">{label}</span><span className="user-field-value">{user[key]}</span></div>
              ))}
            </div>
          </div>
        )}

        {filledChamberFields.length > 0 && (
          <div className="modal-detail-section">
            <h4>Chamber contact details</h4>
            <div className="user-row-grid">
              {filledChamberFields.map(([key, label]) => (
                <div key={key}><span className="user-field-label">{label}</span><span className="user-field-value">{user[key]}</span></div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-detail-section">
          <h4>Chamber Management</h4>
          {chamberStats === null ? (
            <p className="muted small">Loading…</p>
          ) : (
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-card-value">{chamberStats.patients}</div><div className="stat-card-label">Patients</div></div>
              <div className="stat-card"><div className="stat-card-value">{chamberStats.prescriptions}</div><div className="stat-card-label">Prescriptions</div></div>
              <div className="stat-card"><div className="stat-card-value">{chamberStats.appointments}</div><div className="stat-card-label">Appointments</div></div>
            </div>
          )}
        </div>

        <div className="modal-detail-section">
          {user.role === 'super_admin' ? (
            <span className="muted small">Super Admin is fixed — cannot be changed, reset, or deleted.</span>
          ) : (
            <>
              <h4>Actions</h4>
              <div className="user-row-actions" style={{ marginTop: 0 }}>
                <span className="user-field-label" style={{ marginRight: 6 }}>Change role:</span>
                {['examinee', 'moderator', 'admin'].map((r) => (
                  <button
                    key={r}
                    className={user.role === r ? 'role-btn role-btn-active' : 'role-btn'}
                    onClick={() => onChangeRole(user, r)}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <ResetPasswordForm user={user} onDone={onChanged} />
              </div>
              <button className="btn-danger sm" style={{ marginTop: 10 }} onClick={() => onDelete(user)}>Delete account</button>
            </>
          )}
        </div>

        <button className="btn-secondary" style={{ marginTop: 16, width: '100%' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [credentials, setCredentials] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [revealedPw, setRevealedPw] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailUser, setDetailUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Newest registrations first — same convention as every other admin list.
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: creds } = await supabase.from('user_credentials').select('*');
    setUsers(profiles || []);
    const credMap = {};
    (creds || []).forEach((c) => { credMap[c.user_id] = c.plain_password; });
    setCredentials(credMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Keep the open detail modal's data fresh after a change (role, toggle, reset).
  useEffect(() => {
    if (!detailUser) return;
    const fresh = users.find((u) => u.id === detailUser.id);
    if (fresh) setDetailUser(fresh);
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

  const logAudit = async (action, targetUserId, details) => {
    await supabase.from('audit_log').insert({ actor_id: currentUser.id, action, target_user_id: targetUserId, details });
  };

  const changeRole = async (user, newRole) => {
    if (user.role === newRole) return;
    if (!confirm(`Change ${user.full_name}'s role from ${ROLE_LABELS[user.role]} to ${ROLE_LABELS[newRole]}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
    if (error) { alert(error.message); return; }
    await logAudit('role_change', user.id, { from: user.role, to: newRole });
    load();
  };

  const togglePractice = async (user) => {
    await supabase.from('profiles').update({ practice_enabled: !user.practice_enabled }).eq('id', user.id);
    load();
  };

  const toggleLiveExam = async (user) => {
    await supabase.from('profiles').update({ live_exam_enabled: !user.live_exam_enabled }).eq('id', user.id);
    load();
  };

  const removeUser = async (user) => {
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { target_user_id: user.id },
    });
    setDeleting(false);

    if (error) { alert(`Could not reach the delete function: ${error.message}`); return; }
    if (!data?.success) { alert(data?.error || 'Failed to delete user.'); return; }

    await logAudit('account_delete', user.id, { full_name: user.full_name, role: user.role });
    setConfirmDelete(null);
    setDetailUser(null);
    load();
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.mobile_number || '').includes(q);
  });

  const moderatorCount = users.filter((u) => u.role === 'moderator').length;

  return (
    <div className="panel">
      <h2>User Management</h2>
      <p className="muted small">
        {moderatorCount} moderator{moderatorCount !== 1 ? 's' : ''} currently assigned — no limit.
        Tap a name to view full details, change role, reset password, or delete.
      </p>

      <div className="user-mgmt-toolbar">
        <input
          className="search-input"
          placeholder="Search by name, username, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="role-filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="examinee">Student</option>
        </select>
      </div>

      {loading && <div className="muted">Loading users…</div>}
      {!loading && filtered.length === 0 && <div className="muted">No users match this search.</div>}

      <div className="user-table-wrap">
        {filtered.map((u) => (
          <button key={u.id} className="user-list-row" onClick={() => setDetailUser(u)}>
            <div>
              <div className="user-list-row-name">{u.full_name}</div>
              <div className="user-list-row-sub">{u.username} · Joined {fmtDate(u.created_at)}</div>
            </div>
            <RoleBadge role={u.role} />
          </button>
        ))}
      </div>

      {detailUser && (
        <UserDetailModal
          user={detailUser}
          credentials={credentials}
          revealedPw={revealedPw}
          onTogglePw={(id) => setRevealedPw((r) => ({ ...r, [id]: !r[id] }))}
          onClose={() => setDetailUser(null)}
          onChangeRole={changeRole}
          onTogglePractice={togglePractice}
          onToggleLiveExam={toggleLiveExam}
          onDelete={setConfirmDelete}
          onChanged={load}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Delete {confirmDelete.full_name}?</div>
            <div className="modal-body">This removes their account and login access permanently. Their exam results stay on record.</div>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</button>
              <button className="modal-confirm-btn" style={{ background: 'var(--red)' }} onClick={() => removeUser(confirmDelete)} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

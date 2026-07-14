import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ROLE_LABELS = { super_admin: 'Super Admin', admin: 'Admin', moderator: 'Moderator', examinee: 'Student' };

function RoleBadge({ role }) {
  return <span className={`role-badge role-badge-${role}`}>{ROLE_LABELS[role] || role}</span>;
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [credentials, setCredentials] = useState({}); // user_id -> plain_password
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [revealedPw, setRevealedPw] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: creds } = await supabase.from('user_credentials').select('*');
    setUsers(profiles || []);
    const credMap = {};
    (creds || []).forEach((c) => { credMap[c.user_id] = c.plain_password; });
    setCredentials(credMap);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
    const { error } = await supabase.from('profiles').delete().eq('id', user.id);
    if (error) { alert(error.message); return; }
    await logAudit('account_delete', user.id, { full_name: user.full_name, role: user.role });
    setConfirmDelete(null);
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
        Change any user's role below to promote a student to Moderator or demote a Moderator back
        to Student.
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
        {filtered.map((u) => {
          const pw = credentials[u.id];
          const shown = !!revealedPw[u.id];
          return (
            <div key={u.id} className="user-row-card">
              <div className="user-row-top">
                <div className="user-row-name">{u.full_name}</div>
                <RoleBadge role={u.role} />
              </div>

              <div className="user-row-grid">
                <div><span className="user-field-label">User ID</span><span className="user-field-value mono">{u.id}</span></div>
                <div><span className="user-field-label">Username</span><span className="user-field-value">{u.username}</span></div>
                <div><span className="user-field-label">Email</span><span className="user-field-value">{u.email || '—'}</span></div>
                <div><span className="user-field-label">Phone</span><span className="user-field-value">{u.mobile_number || '—'}</span></div>
                <div><span className="user-field-label">Joined</span><span className="user-field-value">{fmtDate(u.created_at)}</span></div>
                <div>
                  <span className="user-field-label">Password</span>
                  <span className="user-field-value mono">
                    {pw ? (shown ? pw : '••••••••') : '—'}
                    {pw && (
                      <button className="pw-toggle" onClick={() => setRevealedPw((r) => ({ ...r, [u.id]: !r[u.id] }))}>
                        {shown ? 'hide' : 'show'}
                      </button>
                    )}
                  </span>
                </div>
                <div>
                  <span className="user-field-label">Practice mode</span>
                  <label className="mini-toggle">
                    <input type="checkbox" checked={u.practice_enabled} onChange={() => togglePractice(u)} />
                    <span>{u.practice_enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
                <div>
                  <span className="user-field-label">Live Exam</span>
                  <label className="mini-toggle">
                    <input type="checkbox" checked={u.live_exam_enabled} onChange={() => toggleLiveExam(u)} />
                    <span>{u.live_exam_enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
              </div>

              <div className="user-row-actions">
                {u.role === 'super_admin' ? (
                  <span className="muted small">Super Admin is fixed — cannot be changed or deleted.</span>
                ) : (
                  <>
                    <span className="user-field-label" style={{ marginRight: 6 }}>Change role:</span>
                    {['examinee', 'moderator', 'admin'].map((r) => (
                      <button
                        key={r}
                        className={u.role === r ? 'role-btn role-btn-active' : 'role-btn'}
                        onClick={() => changeRole(u, r)}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                    <button className="btn-danger sm" onClick={() => setConfirmDelete(u)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Delete {confirmDelete.full_name}?</div>
            <div className="modal-body">This removes their account and login access permanently. Their exam results stay on record.</div>
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="modal-confirm-btn" style={{ background: 'var(--red)' }} onClick={() => removeUser(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

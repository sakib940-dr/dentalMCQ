import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function TrialSettings() {
  const [days, setDays] = useState(15);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_number_settings').select('value').eq('key', 'free_trial_days').maybeSingle();
    if (data) setDays(data.value);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase.from('app_number_settings').upsert({ key: 'free_trial_days', value: days, updated_at: new Date().toISOString() });
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="panel">
      <h2>Free Trial</h2>
      <p className="muted small">
        Every student gets this many free days of exam/practice access, starting from the moment
        they first open a paid category. After it runs out, access locks until payment is
        approved. Prescription is always free and never affected by this.
      </p>
      <form className="exam-form-fields" onSubmit={save} style={{ marginTop: 12 }}>
        <label>
          <span>Free trial length (days)</span>
          <input type="number" min={0} max={365} value={days} onChange={(e) => setDays(Math.max(0, parseInt(e.target.value) || 0))} />
        </label>
        {saved && <div className="ok-box">Saved.</div>}
        <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Saving…' : 'Save trial length'}
        </button>
      </form>
    </div>
  );
}

function PromoCodesPanel() {
  const [codes, setCodes] = useState(null);
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState(10);
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newMaxPerStudent, setNewMaxPerStudent] = useState(1);
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    setCodes(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addCode = async (e) => {
    e.preventDefault();
    setError('');
    if (!newCode.trim()) { setError('Enter a code.'); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from('promo_codes').insert({
      code: newCode.trim().toUpperCase(),
      discount_percent: newDiscount,
      max_uses: newMaxUses === '' ? null : Math.max(1, parseInt(newMaxUses) || 1),
      max_uses_per_student: Math.max(1, parseInt(newMaxPerStudent) || 1),
      expires_at: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setNewCode('');
    setNewDiscount(10);
    setNewMaxUses('');
    setNewMaxPerStudent(1);
    setNewExpiresAt('');
    load();
  };

  const toggleActive = async (code) => {
    await supabase.from('promo_codes').update({ is_active: !code.is_active }).eq('id', code.id);
    load();
  };

  const removeCode = async (code) => {
    if (!confirm(`Delete promo code "${code.code}"?`)) return;
    await supabase.from('promo_codes').delete().eq('id', code.id);
    load();
  };

  return (
    <div className="panel">
      <h2>Promo Codes</h2>
      <p className="muted small">Codes students can apply at checkout for an extra discount.</p>

      <form className="exam-form-fields" onSubmit={addCode} style={{ marginTop: 12 }}>
        <div className="option-grid">
          <label>
            <span>Code</span>
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. WELCOME10" />
          </label>
          <label>
            <span>Discount (%)</span>
            <input type="number" min={1} max={100} value={newDiscount} onChange={(e) => setNewDiscount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))} />
          </label>
        </div>
        <div className="option-grid">
          <label>
            <span>Total use limit (blank = unlimited)</span>
            <input type="number" min={1} value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} placeholder="Unlimited" />
          </label>
          <label>
            <span>Uses per student</span>
            <input type="number" min={1} value={newMaxPerStudent} onChange={(e) => setNewMaxPerStudent(e.target.value)} />
          </label>
        </div>
        <label>
          <span>Expires on (blank = never)</span>
          <input type="date" value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} />
        </label>
        {error && <div className="error-box">{error}</div>}
        <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Adding…' : '+ Add promo code'}
        </button>
      </form>

      {codes === null && <div className="muted small" style={{ marginTop: 12 }}>Loading…</div>}
      {codes && codes.length > 0 && (
        <div className="claims-list" style={{ marginTop: 14 }}>
          {codes.map((c) => (
            <div key={c.id} className="claim-row">
              <div className="claim-row-main">
                <div className="claim-row-name">{c.code} {!c.is_active && <span className="muted small">(inactive)</span>}</div>
                <div className="muted small">
                  {c.discount_percent}% off · Used {c.uses_count}{c.max_uses ? `/${c.max_uses}` : ''} ·
                  {' '}{c.max_uses_per_student} per student
                  {c.expires_at && ` · Expires ${new Date(c.expires_at).toLocaleDateString('en-GB')}`}
                </div>
              </div>
              <div className="claim-row-actions">
                <button className="btn-secondary" onClick={() => toggleActive(c)}>{c.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="btn-danger sm" onClick={() => removeCode(c)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrescriptionLockSettings() {
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'prescription_requires_payment').maybeSingle();
    if (data) setLocked(!!data.value);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    setSaving(true);
    const newValue = !locked;
    await supabase.from('app_settings').upsert({ key: 'prescription_requires_payment', value: newValue });
    setLocked(newValue);
    setSaving(false);
  };

  return (
    <div className="panel">
      <h2>Prescription Access</h2>
      <p className="muted small">
        When locked, students need an active "Prescription" package to use the prescription
        generator — same payment/promo/approval flow as exam categories. Currently free for
        everyone until you turn this on.
      </p>
      <label className="mini-toggle" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={locked} disabled={saving} onChange={toggle} />
        <span>{locked ? 'Locked — requires an active package' : 'Free for everyone'}</span>
      </label>
    </div>
  );
}

function PackageForm({ initial, onSaved, onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(initial?.price ?? 1000);
  const [discount, setDiscount] = useState(initial?.discount_percent ?? 0);
  const [durationDays, setDurationDays] = useState(initial?.duration_days ?? 30);
  const [resourceType, setResourceType] = useState(initial?.resource_type || 'category');
  const [paymentNumber, setPaymentNumber] = useState(initial?.payment_number || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const finalPrice = price * (1 - discount / 100);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Enter a package name.'); return; }
    setSaving(true);
    const payload = { name: name.trim(), price, discount_percent: discount, duration_days: durationDays, resource_type: resourceType, payment_number: paymentNumber || null };
    const { error: saveError } = initial
      ? await supabase.from('packages').update(payload).eq('id', initial.id)
      : await supabase.from('packages').insert(payload);
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSaved();
  };

  return (
    <form className="exam-form-fields" onSubmit={save} style={{ marginTop: 12 }}>
      <label>
        <span>Package name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 3-Month Access" />
      </label>
      <div className="option-grid">
        <label>
          <span>Applies to</span>
          <select value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
            <option value="category">Exam Category</option>
            <option value="prescription">Prescription</option>
          </select>
        </label>
        <label>
          <span>Duration</span>
          <select value={durationDays} onChange={(e) => setDurationDays(parseInt(e.target.value))}>
            <option value={30}>1 Month</option>
            <option value={90}>3 Months</option>
            <option value={180}>6 Months</option>
            <option value={365}>1 Year</option>
          </select>
        </label>
      </div>
      <div className="option-grid">
        <label>
          <span>Price (৳)</span>
          <input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, parseFloat(e.target.value) || 0))} />
        </label>
        <label>
          <span>Discount (%)</span>
          <input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} />
        </label>
      </div>
      <label>
        <span>bKash / Nagad number to display</span>
        <input value={paymentNumber} onChange={(e) => setPaymentNumber(e.target.value)} placeholder="01XXXXXXXXX" />
      </label>
      <div className="exam-time-summary">Students see: ৳{finalPrice.toFixed(0)} {discount > 0 && `(${discount}% off ৳${price})`} for {durationDays} days</div>
      {error && <div className="error-box">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : '+ Create package'}</button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function PackageSettings() {
  const [packages, setPackages] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('packages').select('*').order('resource_type').order('duration_days');
    setPackages(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (pkg) => {
    await supabase.from('packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id);
    load();
  };

  const removePackage = async (pkg) => {
    if (!confirm(`Delete package "${pkg.name}"? Students who already have access keep it — this only removes the package from the list.`)) return;
    const { error } = await supabase.from('packages').delete().eq('id', pkg.id);
    if (error) { alert(`Could not delete: ${error.message}`); return; }
    load();
  };

  return (
    <div className="panel">
      <h2>Packages</h2>
      <p className="muted small">Create as many packages as you like — different durations, prices, and either exam-category or prescription access.</p>

      {packages === null && <div className="muted small" style={{ marginTop: 10 }}>Loading…</div>}

      <div className="claims-list" style={{ marginTop: 12 }}>
        {packages?.map((p) => (
          <div key={p.id}>
            {editingId === p.id ? (
              <div className="claim-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <PackageForm initial={p} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div className="claim-row">
                <div className="claim-row-main">
                  <div className="claim-row-name">{p.name} {!p.is_active && <span className="muted small">(inactive)</span>}</div>
                  <div className="muted small">
                    {p.resource_type === 'prescription' ? 'Prescription' : 'Exam Category'} · {p.duration_days} days ·
                    {' '}৳{(p.price * (1 - p.discount_percent / 100)).toFixed(0)}
                    {p.discount_percent > 0 && ` (${p.discount_percent}% off ৳${p.price})`}
                  </div>
                </div>
                <div className="claim-row-actions">
                  <button className="btn-secondary" onClick={() => setEditingId(p.id)}>Edit</button>
                  <button className="btn-secondary" onClick={() => toggleActive(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button className="btn-danger sm" onClick={() => removePackage(p)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {creating ? (
        <PackageForm onSaved={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />
      ) : (
        <button className="btn-primary" onClick={() => setCreating(true)} style={{ marginTop: 12 }}>+ New Package</button>
      )}
    </div>
  );
}

function PaymentClaimsInbox() {
  const [claims, setClaims] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_all_payment_claims');
    if (error) console.error('Failed to load payment claims:', error.message);
    setClaims(data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (claim, status) => {
    const { error } = await supabase.rpc('review_payment_claim', { claim_id: claim.id, new_status: status });
    if (error) console.error('Failed to review claim:', error.message);
    load();
  };

  const visibleClaims = (claims || []).filter((c) => filter === 'all' || c.status === filter);

  return (
    <div className="panel">
      <h2>Payment Claims</h2>
      <div className="mode-tabs">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button key={f} className={filter === f ? 'mode-tab mode-tab-active' : 'mode-tab'} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {claims === null && <div className="muted small">Loading…</div>}
      {claims && visibleClaims.length === 0 && <div className="muted small">No {filter !== 'all' ? filter : ''} claims.</div>}

      <div className="claims-list">
        {visibleClaims.map((c) => (
          <div key={c.id} className="claim-row">
            <div className="claim-row-main">
              <div className="claim-row-name">{c.student_full_name || 'Student'}</div>
              <div className="muted small">{c.student_mobile} · {c.category_name || (c.resource_type === 'prescription' ? 'Prescription' : 'All categories')}</div>
              <div className="muted small">
                {c.method === 'discount_claim' ? 'Free discount claim' : `${c.method} · TXN: ${c.transaction_id}`}
                {c.amount_paid != null && ` · ৳${c.amount_paid}`}
              </div>
              <div className="muted small">{fmtDateTime(c.created_at)}</div>
            </div>
            {c.status === 'pending' ? (
              <div className="claim-row-actions">
                <button className="btn-secondary" onClick={() => review(c, 'approved')}>Approve</button>
                <button className="btn-danger sm" onClick={() => review(c, 'rejected')}>Reject</button>
              </div>
            ) : (
              <span className={`status-pill status-${c.status === 'approved' ? 'live' : 'archived'}`}>{c.status}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PaymentAdminPage() {
  return (
    <>
      <TrialSettings />
      <PrescriptionLockSettings />
      <PackageSettings />
      <PromoCodesPanel />
      <PaymentClaimsInbox />
    </>
  );
}

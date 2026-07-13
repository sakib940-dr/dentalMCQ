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
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setNewCode('');
    setNewDiscount(10);
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
                <div className="claim-row-name">{c.code}</div>
                <div className="muted small">{c.discount_percent}% off</div>
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

function PackageSettings() {
  const [pkg, setPkg] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(1000);
  const [discount, setDiscount] = useState(100);
  const [paymentNumber, setPaymentNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('packages').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data) {
      setPkg(data);
      setName(data.name);
      setPrice(data.price);
      setDiscount(data.discount_percent);
      setPaymentNumber(data.payment_number || '');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    if (pkg) {
      await supabase.from('packages').update({
        name, price, discount_percent: discount, payment_number: paymentNumber,
      }).eq('id', pkg.id);
    } else {
      await supabase.from('packages').insert({ name, price, discount_percent: discount, payment_number: paymentNumber });
    }
    setSaving(false);
    setSaved(true);
    load();
  };

  const finalPrice = price * (1 - discount / 100);

  return (
    <div className="panel">
      <h2>Package Pricing</h2>
      <p className="muted small">Controls what students see on the Package/Payment page.</p>
      <form className="exam-form-fields" onSubmit={save} style={{ marginTop: 12 }}>
        <label>
          <span>Package name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
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
        <div className="exam-time-summary">Students currently see: ৳{finalPrice.toFixed(0)} {discount > 0 && `(${discount}% off ৳${price})`}</div>
        {saved && <div className="ok-box">Saved.</div>}
        <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
          {saving ? 'Saving…' : 'Save pricing'}
        </button>
      </form>
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
              <div className="muted small">{c.student_mobile} · {c.category_name || 'All categories'}</div>
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
      <PackageSettings />
      <PromoCodesPanel />
      <PaymentClaimsInbox />
    </>
  );
}

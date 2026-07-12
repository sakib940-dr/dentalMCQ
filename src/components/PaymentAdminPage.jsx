import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
  const { user } = useAuth();
  const [claims, setClaims] = useState(null);
  const [filter, setFilter] = useState('pending');

  const load = useCallback(async () => {
    let query = supabase.from('payment_claims').select('*, profiles(full_name, username, mobile_number), categories(name)').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setClaims(data || []);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const review = async (claim, status) => {
    await supabase.from('payment_claims').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', claim.id);
    if (status === 'approved' && claim.category_id) {
      await supabase.from('category_access_grants').upsert({
        examinee_id: claim.examinee_id,
        category_id: claim.category_id,
        granted_by: user.id,
        source_claim_id: claim.id,
      }, { onConflict: 'examinee_id,category_id' });
    }
    load();
  };

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
      {claims && claims.length === 0 && <div className="muted small">No {filter !== 'all' ? filter : ''} claims.</div>}

      <div className="claims-list">
        {claims?.map((c) => (
          <div key={c.id} className="claim-row">
            <div className="claim-row-main">
              <div className="claim-row-name">{c.profiles?.full_name || 'Student'}</div>
              <div className="muted small">{c.profiles?.mobile_number} · {c.categories?.name || 'All categories'}</div>
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
      <PackageSettings />
      <PaymentClaimsInbox />
    </>
  );
}

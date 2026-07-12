import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function PackagePage() {
  const { user } = useAuth();
  const [pkg, setPkg] = useState(null);
  const [categories, setCategories] = useState([]);
  const [myGrants, setMyGrants] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState('');

  const [method, setMethod] = useState('bkash');
  const [txnId, setTxnId] = useState('');
  const [submittingTxn, setSubmittingTxn] = useState(false);
  const [txnError, setTxnError] = useState('');
  const [txnSuccess, setTxnSuccess] = useState('');

  const load = async () => {
    const [{ data: pkgData }, { data: catData }, { data: grantData }, { data: claimData }] = await Promise.all([
      supabase.from('packages').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
      supabase.from('category_access_grants').select('category_id').eq('examinee_id', user.id),
      supabase.from('payment_claims').select('*, categories(name)').eq('examinee_id', user.id).order('created_at', { ascending: false }),
    ]);
    setPkg(pkgData || null);
    setCategories(catData || []);
    setMyGrants((grantData || []).map((g) => g.category_id));
    setMyClaims(claimData || []);
  };

  useEffect(() => { load(); }, [user.id]);

  const claimFree = async (catId) => {
    setClaiming(true);
    setClaimError('');
    setClaimSuccess('');
    const { error } = await supabase.rpc('claim_free_package_access', { target_category_id: catId });
    setClaiming(false);
    if (error) { setClaimError(error.message); return; }
    setClaimSuccess('Access granted! You can start practicing right away.');
    load();
  };

  const submitTxn = async (e) => {
    e.preventDefault();
    setTxnError('');
    setTxnSuccess('');
    if (!categoryId) { setTxnError('Select a category.'); return; }
    if (!txnId.trim()) { setTxnError('Enter your transaction ID.'); return; }

    setSubmittingTxn(true);
    const { error } = await supabase.from('payment_claims').insert({
      examinee_id: user.id,
      package_id: pkg?.id,
      method,
      transaction_id: txnId.trim(),
      amount_paid: pkg ? pkg.price * (1 - pkg.discount_percent / 100) : null,
      category_id: categoryId,
      status: 'pending',
    });
    setSubmittingTxn(false);
    if (error) { setTxnError(error.message); return; }
    setTxnSuccess('Submitted! An admin will review and activate your access shortly.');
    setTxnId('');
    load();
  };

  if (!pkg) return <div className="panel"><p className="muted">Loading…</p></div>;

  const finalPrice = pkg.price * (1 - pkg.discount_percent / 100);

  return (
    <>
      <div className="panel">
        <h2>{pkg.name}</h2>
        <div className="package-price-row">
          {pkg.discount_percent > 0 && <span className="package-price-original">৳{pkg.price}</span>}
          <span className="package-price-final">৳{finalPrice.toFixed(0)}</span>
          {pkg.discount_percent > 0 && <span className="package-discount-tag">{pkg.discount_percent}% OFF</span>}
        </div>
        <p className="muted small">Unlocks full access (live exams, practice, results) for the category you choose.</p>

        {pkg.discount_percent >= 100 && (
          <div className="claim-free-box">
            <label className="field-block">
              <span>Category to unlock</span>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} disabled={myGrants.includes(c.id)}>
                    {c.name}{myGrants.includes(c.id) ? ' (already unlocked)' : ''}
                  </option>
                ))}
              </select>
            </label>
            {claimError && <div className="error-box">{claimError}</div>}
            {claimSuccess && <div className="ok-box">{claimSuccess}</div>}
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 10 }}
              disabled={!categoryId || claiming}
              onClick={() => claimFree(categoryId)}
            >
              {claiming ? 'Activating…' : `Claim ${pkg.discount_percent}% Discount — Free`}
            </button>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Pay via bKash / Nagad</h2>
        <p className="muted small">
          Send ৳{finalPrice.toFixed(0)} to <b>{pkg.payment_number || 'the number provided by your admin'}</b>,
          then submit your transaction ID below. An admin will verify and activate your access.
        </p>

        <form className="exam-form-fields" onSubmit={submitTxn} style={{ marginTop: 12 }}>
          <label>
            <span>Payment method</span>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="bkash">bKash</option>
              <option value="nagad">Nagad</option>
            </select>
          </label>
          <label>
            <span>Category to unlock</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span>Transaction ID</span>
            <input value={txnId} onChange={(e) => setTxnId(e.target.value)} placeholder="e.g. 8N7A6B5C4D" />
          </label>
          {txnError && <div className="error-box">{txnError}</div>}
          {txnSuccess && <div className="ok-box">{txnSuccess}</div>}
          <button type="submit" className="btn-primary" disabled={submittingTxn} style={{ alignSelf: 'flex-start' }}>
            {submittingTxn ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      </div>

      {myClaims.length > 0 && (
        <div className="panel">
          <h2>My submissions</h2>
          <div className="recent-list">
            {myClaims.map((c) => (
              <div key={c.id} className="recent-row">
                <div>
                  <span className="recent-name">{c.categories?.name || 'All categories'}</span>
                  <span className="muted small"> · {c.method} · {fmtDateTime(c.created_at)}</span>
                </div>
                <span className={`status-pill status-${c.status === 'approved' ? 'live' : c.status === 'rejected' ? 'archived' : 'upcoming'}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

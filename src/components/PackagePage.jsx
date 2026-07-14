import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fmtDateTime } from '../lib/formatters';

function durationLabel(days) {
  if (days === 30) return '1 Month';
  if (days === 90) return '3 Months';
  if (days === 180) return '6 Months';
  if (days === 365) return '1 Year';
  return `${days} Days`;
}

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ---------- My active subscriptions panel — one row per category,
// each with its own independent expiry, exactly matching the new
// architecture where every linked category gets its own grant. ----------
function MySubscriptionsPanel({ grants, categories }) {
  if (grants.length === 0) return null;
  return (
    <div className="panel">
      <h2>My Subscriptions</h2>
      <div className="recent-list">
        {grants.map((g) => {
          const remaining = daysLeft(g.expires_at);
          const expired = remaining !== null && remaining <= 0;
          const name = g.resource_type === 'prescription' ? 'Prescription' : (categories.find((c) => c.id === g.category_id)?.name || 'Category');
          return (
            <div key={g.id} className="recent-row">
              <span className="recent-name">{name}</span>
              <span className={expired ? 'status-pill status-archived' : 'status-pill status-live'}>
                {expired ? 'Expired' : `${remaining} day${remaining !== 1 ? 's' : ''} left`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PackagePage() {
  const { user } = useAuth();
  const [packages, setPackages] = useState(null);
  const [categoryNamesByPackage, setCategoryNamesByPackage] = useState({});
  const [categories, setCategories] = useState([]);
  const [myGrants, setMyGrants] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claimSuccess, setClaimSuccess] = useState('');

  const [method, setMethod] = useState('bkash');
  const [txnId, setTxnId] = useState('');
  const [submittingTxn, setSubmittingTxn] = useState(false);
  const [txnError, setTxnError] = useState('');
  const [txnSuccess, setTxnSuccess] = useState('');

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);

  const load = async () => {
    const [{ data: pkgData }, { data: catData }, { data: grantData }, { data: claimData }] = await Promise.all([
      supabase.from('packages').select('*').eq('is_active', true).order('package_type').order('duration_days'),
      supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
      supabase.from('category_access_grants').select('*').eq('examinee_id', user.id),
      supabase.from('payment_claims').select('*, packages(name)').eq('examinee_id', user.id).order('created_at', { ascending: false }),
    ]);
    setPackages(pkgData || []);
    setCategories(catData || []);
    setMyGrants(grantData || []);
    setMyClaims(claimData || []);
    if (!selectedPkgId && pkgData?.length > 0) setSelectedPkgId(pkgData[0].id);

    // Bulk-load which categories each package unlocks, for display —
    // this is what tells the student EXACTLY what they're buying, no
    // guessing or manual selection needed anymore.
    const ids = (pkgData || []).map((p) => p.id);
    if (ids.length > 0) {
      const { data: links } = await supabase
        .from('package_categories')
        .select('package_id, categories(name)')
        .in('package_id', ids);
      const grouped = {};
      (links || []).forEach((l) => {
        if (!grouped[l.package_id]) grouped[l.package_id] = [];
        if (l.categories?.name) grouped[l.package_id].push(l.categories.name);
      });
      setCategoryNamesByPackage(grouped);
    }
  };

  useEffect(() => { load(); }, [user.id]);

  const selectedPkg = packages?.find((p) => p.id === selectedPkgId) || null;
  const selectedPkgCategoryNames = selectedPkg ? (categoryNamesByPackage[selectedPkg.id] || []) : [];

  const combinedDiscount = selectedPkg
    ? Math.min(100, selectedPkg.discount_percent + (appliedPromo?.discount_percent || 0))
    : 0;
  const finalPrice = selectedPkg ? selectedPkg.price * (1 - combinedDiscount / 100) : 0;

  const claimFree = async () => {
    if (!selectedPkg) return;
    setClaiming(true);
    setClaimError('');
    setClaimSuccess('');
    // The package itself now carries its linked categories server-side
    // — no category selection needed from the student anymore.
    const { error } = await supabase.rpc('claim_free_package_access', {
      target_package_id: selectedPkg.id,
    });
    setClaiming(false);
    if (error) { setClaimError(error.message); return; }
    setClaimSuccess('Access granted! You can start right away.');
    load();
  };

  const applyPromo = async () => {
    setPromoError('');
    if (!promoInput.trim()) { setPromoError('Enter a promo code.'); return; }
    setApplyingPromo(true);
    const { data, error } = await supabase.rpc('validate_and_redeem_promo', { promo_code: promoInput.trim() });
    setApplyingPromo(false);
    const result = data?.[0];
    if (error || !result?.valid) {
      setPromoError(result?.message || error?.message || 'Invalid promo code.');
      setAppliedPromo(null);
      return;
    }
    setAppliedPromo({ id: result.promo_code_id, code: promoInput.trim().toUpperCase(), discount_percent: result.discount_percent });
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  };

  const submitTxn = async (e) => {
    e.preventDefault();
    setTxnError('');
    setTxnSuccess('');
    if (!selectedPkg) return;
    if (!txnId.trim()) { setTxnError('Enter your transaction ID.'); return; }

    setSubmittingTxn(true);
    // category_id is intentionally left null here — the package's own
    // linked categories (package_categories) are what determine what
    // gets unlocked once approved, not a student-picked value.
    const { data: inserted, error } = await supabase.from('payment_claims').insert({
      examinee_id: user.id,
      package_id: selectedPkg.id,
      method,
      transaction_id: txnId.trim(),
      amount_paid: finalPrice,
      final_amount: finalPrice,
      discount_percent: combinedDiscount,
      promo_code_id: appliedPromo?.id || null,
      category_id: null,
      resource_type: selectedPkg.package_type === 'prescription' ? 'prescription' : 'category',
      status: 'pending',
    }).select('id').single();

    if (error) {
      setSubmittingTxn(false);
      if (error.code === '23505') {
        setTxnError('You already have a pending submission for this package — please wait for it to be reviewed before submitting another.');
      } else {
        setTxnError(error.message);
      }
      return;
    }

    if (appliedPromo?.id) {
      await supabase.rpc('record_promo_redemption', { target_promo_code_id: appliedPromo.id, target_claim_id: inserted.id });
    }

    setSubmittingTxn(false);
    setTxnSuccess('Submitted! An admin will review and activate your access shortly.');
    setTxnId('');
    removePromo();
    load();
  };

  if (packages === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <>
      <MySubscriptionsPanel grants={myGrants} categories={categories} />

      <div className="panel">
        <h2>Packages</h2>
        <p className="muted small">Each package unlocks the specific categories listed on it — nothing else.</p>

        {packages.length === 0 && <div className="muted small" style={{ marginTop: 10 }}>No packages available right now.</div>}

        <div className="package-card-list">
          {packages.map((p) => {
            const isSelected = p.id === selectedPkgId;
            const catNames = categoryNamesByPackage[p.id] || [];
            return (
              <button
                key={p.id}
                className={isSelected ? 'package-card package-card-selected' : 'package-card'}
                onClick={() => { setSelectedPkgId(p.id); removePromo(); }}
              >
                <div className="package-card-name">{p.name}</div>
                <div className="package-card-duration">
                  {durationLabel(p.duration_days)} · {p.package_type === 'prescription' ? 'Prescription' : catNames.length > 0 ? catNames.join(', ') : 'No categories linked'}
                </div>
                <div className="package-card-price">
                  {p.discount_percent > 0 && <span className="package-price-original">৳{p.price}</span>}
                  {' '}৳{(p.price * (1 - p.discount_percent / 100)).toFixed(0)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedPkg && (
        <div className="panel">
          <h2>{selectedPkg.name}</h2>
          {selectedPkg.description && <p className="muted small">{selectedPkg.description}</p>}

          {selectedPkg.package_type !== 'prescription' && (
            <div className="package-unlock-list">
              <span className="compact-field-label">This unlocks:</span>
              {selectedPkgCategoryNames.length > 0 ? (
                <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                  {selectedPkgCategoryNames.map((name) => <li key={name} className="muted small">{name}</li>)}
                </ul>
              ) : (
                <div className="error-box" style={{ marginTop: 6 }}>This package has no categories linked yet — contact an admin before purchasing.</div>
              )}
            </div>
          )}

          <div className="payment-breakdown" style={{ marginTop: 12 }}>
            <div className="payment-breakdown-row">
              <span>Original Amount</span>
              <span>৳{selectedPkg.price}</span>
            </div>
            <div className="payment-breakdown-row">
              <span>Discount ({combinedDiscount}%)</span>
              <span>− ৳{(selectedPkg.price - finalPrice).toFixed(0)}</span>
            </div>
            <div className="payment-breakdown-row payment-breakdown-final">
              <span>Amount to Pay</span>
              <span>৳{finalPrice.toFixed(0)}</span>
            </div>
          </div>

          <div className="promo-apply-row">
            {appliedPromo ? (
              <div className="promo-applied-tag">
                ✓ "{appliedPromo.code}" applied (+{appliedPromo.discount_percent}% off)
                <button className="promo-remove-btn" onClick={removePromo}>✕</button>
              </div>
            ) : (
              <>
                <input className="promo-input" placeholder="Promo code" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} />
                <button className="btn-secondary" onClick={applyPromo} disabled={applyingPromo}>
                  {applyingPromo ? '…' : 'Apply'}
                </button>
              </>
            )}
          </div>
          {promoError && <div className="error-box" style={{ marginTop: 8 }}>{promoError}</div>}

          {selectedPkg.discount_percent >= 100 && (
            <div className="claim-free-box">
              {claimError && <div className="error-box">{claimError}</div>}
              {claimSuccess && <div className="ok-box">{claimSuccess}</div>}
              <button
                className="btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                disabled={claiming || (selectedPkg.package_type !== 'prescription' && selectedPkgCategoryNames.length === 0)}
                onClick={claimFree}
              >
                {claiming ? 'Activating…' : `Claim ${selectedPkg.discount_percent}% Discount — Free`}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedPkg && (
        <div className="panel">
          <h2>Pay via bKash / Nagad</h2>
          <p className="muted small">
            Send ৳{finalPrice.toFixed(0)} to <b>{selectedPkg.payment_number || 'the number provided by your admin'}</b>,
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
      )}

      {myClaims.length > 0 && (
        <div className="panel">
          <h2>My submissions</h2>
          <div className="recent-list">
            {myClaims.map((c) => (
              <div key={c.id} className="recent-row">
                <div>
                  <span className="recent-name">{c.packages?.name || 'Package'}</span>
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

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function durationLabel(days) {
  if (days === 30) return '1 Month';
  if (days === 90) return '3 Months';
  if (days === 180) return '6 Months';
  if (days === 365) return '1 Year';
  return `${days} Days`;
}

export default function PackagesReadOnlyPage() {
  const [packages, setPackages] = useState(null);

  useEffect(() => {
    supabase.from('packages').select('*').order('resource_type').order('duration_days').then(({ data }) => setPackages(data || []));
  }, []);

  if (packages === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>Packages</h2>
      <p className="muted small">View-only — pricing, promo codes, and payment approvals are managed by the Super Admin.</p>

      {packages.length === 0 && <div className="muted small" style={{ marginTop: 10 }}>No packages yet.</div>}

      <div className="claims-list" style={{ marginTop: 12 }}>
        {packages.map((p) => (
          <div key={p.id} className="claim-row">
            <div className="claim-row-main">
              <div className="claim-row-name">{p.name} {!p.is_active && <span className="muted small">(inactive)</span>}</div>
              <div className="muted small">
                {p.resource_type === 'prescription' ? 'Prescription' : 'Exam Category'} · {durationLabel(p.duration_days)} ·
                {' '}৳{(p.price * (1 - p.discount_percent / 100)).toFixed(0)}
                {p.discount_percent > 0 && ` (${p.discount_percent}% off ৳${p.price})`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

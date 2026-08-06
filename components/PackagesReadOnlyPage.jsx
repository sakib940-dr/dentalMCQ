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
  const [categoryNamesByPackage, setCategoryNamesByPackage] = useState({});

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('packages').select('*').order('package_type').order('duration_days');
      setPackages(data || []);
      const ids = (data || []).map((p) => p.id);
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
    }
    load();
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
                {p.package_type === 'prescription' ? 'Prescription' : p.package_type === 'bundle' ? 'Bundle' : 'Exam Category'} · {durationLabel(p.duration_days)} ·
                {' '}৳{(p.price * (1 - p.discount_percent / 100)).toFixed(0)}
                {p.discount_percent > 0 && ` (${p.discount_percent}% off ৳${p.price})`}
              </div>
              {p.package_type !== 'prescription' && (
                <div className="muted small" style={{ marginTop: 2 }}>
                  Unlocks: {categoryNamesByPackage[p.id]?.length ? categoryNamesByPackage[p.id].join(', ') : 'No categories linked'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

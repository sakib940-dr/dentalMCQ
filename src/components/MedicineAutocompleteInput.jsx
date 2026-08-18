import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Medicine autocomplete backed by:
 *  1) the current doctor's previously prescribed medicine names (recent first)
 *  2) the verified drug_master catalog imported by an authorized admin
 *
 * This component never invents medication directions. It only searches data
 * already stored in the application and returns the selected display name.
 */
export default function MedicineAutocompleteInput({ value, onChange, onSelect, placeholder = 'Medicine name' }) {
  const [open, setOpen] = useState(false);
  const [recentItems, setRecentItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const q = (value || '').trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const [recentRes, catalogRes] = await Promise.all([
        supabase.rpc('search_recent_prescription_medicines', {
          p_search_term: q,
          p_limit: 6,
        }),
        q.length >= 2
          ? supabase.rpc('search_drug_master', {
              p_search_term: q,
              p_limit: 10,
            })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancelled) return;
      setLoading(false);
      setRecentItems(recentRes.error ? [] : (recentRes.data || []));
      setCatalogItems(catalogRes.error ? [] : (catalogRes.data || []));
      setActive(-1);
      const hasResults = (recentRes.data || []).length > 0 || (catalogRes.data || []).length > 0;
      setOpen(hasResults);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  const items = useMemo(() => {
    const seen = new Set();
    const merged = [];
    for (const item of recentItems) {
      const key = String(item.display_name || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...item, source: 'recent' });
    }
    for (const item of catalogItems) {
      const key = String(item.display_name || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...item, source: 'catalog' });
    }
    return merged;
  }, [recentItems, catalogItems]);

  const choose = (item) => {
    const next = item.display_name || '';
    onChange(next);
    onSelect?.(item);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (event) => {
    if (!open || items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="medicine-autocomplete" ref={wrapRef}>
      <input
        className="medicine-name-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (items.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />

      {open && items.length > 0 && (
        <div className="medicine-suggestion-popover" role="listbox">
          {items.map((item, index) => (
            <button
              type="button"
              key={`${item.source}-${item.id || item.display_name}-${index}`}
              className={`medicine-suggestion-item${active === index ? ' medicine-suggestion-item-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
            >
              <span className="medicine-suggestion-copy">
                <strong>{item.display_name}</strong>
                {(item.generic_name || item.company_name) && (
                  <span className="medicine-suggestion-meta">
                    {[item.generic_name, item.company_name].filter(Boolean).join(' • ')}
                  </span>
                )}
              </span>
              {item.source === 'recent' && <span className="medicine-suggestion-tag">Recent</span>}
            </button>
          ))}
        </div>
      )}
      {loading && <span className="medicine-autocomplete-loading">…</span>}
    </div>
  );
}

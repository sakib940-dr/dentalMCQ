import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ClinicalAutocompleteInput({ value, onChange, category, placeholder = 'Type here' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
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
    if (!q) {
      setItems([]);
      setActive(-1);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('search_clinical_suggestions', {
        p_category: category,
        p_search_term: q,
        p_limit: 8,
      });
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setItems([]);
        return;
      }
      setItems(data || []);
      setActive(-1);
      setOpen((data || []).length > 0);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, category]);

  const choose = (item) => {
    onChange(item.text);
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
    <div className="clinical-autocomplete" ref={wrapRef}>
      <input
        className="clinical-line-text-compact"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (items.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && (
        <div className="clinical-suggestion-popover" role="listbox">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id || `${item.text}-${index}`}
              className={`clinical-suggestion-item${active === index ? ' clinical-suggestion-item-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
            >
              <span>{item.text}</span>
              {item.source === 'recent' && <span className="clinical-suggestion-tag">Recent</span>}
            </button>
          ))}
        </div>
      )}
      {loading && <span className="clinical-autocomplete-loading">…</span>}
    </div>
  );
}

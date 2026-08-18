import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const COMMON_ITEMS = {
  dose: [
    '1+1+1',
    '1+0+1',
    '0+0+1',
    '1+0+0',
    '0+1+0',
  ],
  meal_instruction: [
    'খাবারের ৩০ মিনিট আগে খাবেন।',
    'খাবারের ৩০ মিনিট পরে খাবেন।',
    'ভরা পেটে খাবেন।',
    'খালি পেটে খাবেন।',
    'খাবারের সাথে খাবেন।',
  ],
};

const normalize = (value) => String(value || '').trim().toLowerCase();

export default function MedicineInstructionAutocompleteInput({
  value,
  onChange,
  category,
  placeholder,
}) {
  const [open, setOpen] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const commonItems = COMMON_ITEMS[category] || [];

  const filteredCommon = useMemo(() => {
    const q = normalize(value);
    return commonItems
      .filter((text) => !q || normalize(text).includes(q))
      .map((text, index) => ({ id: `common-${category}-${index}`, text, source: 'common' }));
  }, [category, commonItems, value]);

  const items = useMemo(() => {
    const seen = new Set();
    const merged = [];

    for (const item of savedItems) {
      const key = normalize(item.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...item, source: 'saved' });
    }

    for (const item of filteredCommon) {
      const key = normalize(item.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    return merged.slice(0, 12);
  }, [savedItems, filteredCommon]);

  useEffect(() => {
    const onDoc = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetchSaved = async (rawValue = value) => {
    setLoading(true);
    const { data, error } = await supabase.rpc('search_prescription_text_suggestions', {
      p_category: category,
      p_search_term: String(rawValue || '').trim(),
      p_limit: 10,
    });
    setLoading(false);
    setSavedItems(error ? [] : (data || []));
    setActive(-1);
  };

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_prescription_text_suggestions', {
        p_category: category,
        p_search_term: String(value || '').trim(),
        p_limit: 10,
      });
      if (cancelled) return;
      setSavedItems(error ? [] : (data || []));
      setActive(-1);
    }, 160);

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
      setActive((current) => (current + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="medicine-instruction-autocomplete" ref={wrapRef}>
      <input
        className="medicine-instruction-input"
        value={value || ''}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          fetchSaved(value);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />

      {open && items.length > 0 && (
        <div className="medicine-instruction-popover" role="listbox">
          {items.map((item, index) => (
            <button
              type="button"
              key={`${item.source}-${item.id || item.text}-${index}`}
              className={`medicine-instruction-suggestion${active === index ? ' medicine-instruction-suggestion-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
            >
              <span>{item.text}</span>
              <span className={`medicine-instruction-badge medicine-instruction-badge-${item.source}`}>
                {item.source === 'saved' ? 'Recent' : 'Common'}
              </span>
            </button>
          ))}
        </div>
      )}
      {loading && <span className="medicine-instruction-loading">…</span>}
    </div>
  );
}

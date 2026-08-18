import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Dentist-focused starter phrases. These are documentation shortcuts only;
// the clinician remains responsible for confirming the final note/plan.
const DENTAL_STARTER_TEMPLATES = {
  chief_complaint: [
    'Pain in tooth',
    'Sensitivity to hot/cold',
    'Swelling in gum/face',
    'Bleeding from gums',
    'Food impaction between teeth',
    'Pain on biting or chewing',
    'Broken or chipped tooth',
    'Loose or mobile tooth',
    'Persistent bad breath',
    'Gum pain or tenderness',
    'Discharge from gum',
    'Difficulty opening mouth',
    'Difficulty chewing',
    'Missing tooth / wants replacement',
    'Discolored tooth',
    'Ulcer or sore in mouth',
    'Pain after previous dental treatment',
    'Sensitivity to sweet foods',
    'Jaw joint pain or clicking',
    'Denture discomfort or looseness',
  ],
  history: [
    'Spontaneous or nocturnal pain',
    'Pain aggravated by hot or cold',
    'Pain on biting or chewing',
    'History of swelling or discharge',
    'Previous treatment/restoration in the same tooth',
    'History of trauma to the tooth',
    'Pain started suddenly',
    'Intermittent episodes of pain',
    'Continuous pain',
    'Radiating pain',
    'Pain wakes patient from sleep',
    'History of recurrent swelling',
    'Previous root canal treatment in the same tooth',
    'Previous extraction in the same region',
    'History of food impaction',
    'History of gum bleeding during brushing',
    'History of tooth mobility',
    'History of sensitivity to sweets',
    'History of clenching or grinding',
    'History of denture use or discomfort',
  ],
  on_examination: [
    'Dental caries present',
    'Tenderness on percussion',
    'Tenderness on palpation',
    'Localized gingival swelling',
    'Plaque and calculus present',
    'Tooth mobility present',
    'Gingival bleeding on probing',
    'Periodontal pocketing present',
    'Gingival recession present',
    'Fractured or chipped tooth present',
    'Discolored tooth present',
    'Missing tooth / teeth',
    'Existing restoration present',
    'Defective restoration present',
    'Sinus tract or discharge present',
    'Facial swelling present',
    'Limited mouth opening',
    'Oral ulcer or soft-tissue lesion present',
    'Food impaction area present',
    'TMJ clicking or tenderness present',
  ],
  investigation: [
    'IOPA radiograph',
    'Bitewing radiograph',
    'Panoramic radiograph (OPG)',
    'Occlusal radiograph',
    'CBCT if clinically indicated',
    'Pulp sensibility testing',
    'Cold test',
    'Electric pulp test',
    'Percussion test',
    'Palpation test',
    'Periodontal charting / probing',
    'Tooth mobility assessment',
    'Bite test',
    'Transillumination test',
    'Crack assessment',
    'Occlusal assessment',
    'Intraoral photographic documentation',
    'Study cast / digital intraoral scan',
    'Caries risk assessment',
    'Further investigation / specialist assessment if indicated',
  ],
  treatment_plan: [
    'Oral hygiene instruction and review',
    'Scaling and polishing',
    'Periodontal therapy and review',
    'Restorative treatment',
    'Temporary restoration and reassessment',
    'Definitive restoration as indicated',
    'Endodontic assessment / treatment',
    'Extraction assessment',
    'Surgical extraction referral if required',
    'Replacement of missing tooth / prosthodontic assessment',
    'Crown or onlay assessment',
    'Repair or replacement of defective restoration',
    'Periodontal maintenance and recall',
    'Management of dentin sensitivity and review',
    'Occlusal assessment / adjustment if indicated',
    'Occlusal splint assessment for clenching or grinding',
    'Management of pericoronal inflammation and review',
    'Specialist referral if required',
    'Follow-up and reassessment',
    'Preventive care and recall planning',
  ],
};

const searchTokens = (rawValue) =>
  String(rawValue || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

const matchesAnySearchWord = (text, rawValue) => {
  const tokens = searchTokens(rawValue);
  if (tokens.length === 0) return true;
  const haystack = String(text || '').toLowerCase();
  return tokens.some((token) => haystack.includes(token));
};


export default function ClinicalAutocompleteInput({ value, onChange, category, placeholder = 'Type here' }) {
  const [open, setOpen] = useState(false);
  const [remoteItems, setRemoteItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const starterItems = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    return (DENTAL_STARTER_TEMPLATES[category] || [])
      .filter((text) => matchesAnySearchWord(text, q))
      .map((text, index) => ({ id: `starter-${category}-${index}`, text, source: 'common' }));
  }, [category, value]);

  const items = useMemo(() => {
    const seen = new Set();
    const merged = [];

    // Doctor-specific recent/frequent entries from Supabase always win.
    for (const item of remoteItems.filter((item) => item.source === 'recent')) {
      const key = String(item.text || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    // Professional starter templates come next.
    for (const item of starterItems) {
      const key = String(item.text || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    // Any other global/common DB matches follow.
    for (const item of remoteItems.filter((item) => item.source !== 'recent')) {
      const key = String(item.text || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    return merged.slice(0, 20);
  }, [remoteItems, starterItems]);

  useEffect(() => {
    const onDoc = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetchSuggestions = async (rawValue = value) => {
    const q = (rawValue || '').trim();
    setLoading(true);
    const { data, error } = await supabase.rpc('search_clinical_suggestions', {
      p_category: category,
      p_search_term: q,
      p_limit: 20,
    });
    setLoading(false);
    setRemoteItems(error ? [] : (data || []));
    setActive(-1);
  };

  useEffect(() => {
    const q = (value || '').trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!q) {
        setRemoteItems([]);
        setActive(-1);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase.rpc('search_clinical_suggestions', {
        p_category: category,
        p_search_term: q,
        p_limit: 20,
      });
      if (cancelled) return;
      setLoading(false);
      setRemoteItems(error ? [] : (data || []));
      setActive(-1);
      setOpen(true);
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
        onFocus={() => {
          setOpen(true);
          fetchSuggestions(value);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && items.length > 0 && (
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
              {item.source !== 'recent' && <span className="clinical-suggestion-tag clinical-suggestion-tag-common">Common</span>}
            </button>
          ))}
        </div>
      )}
      {loading && <span className="clinical-autocomplete-loading">…</span>}
    </div>
  );
}

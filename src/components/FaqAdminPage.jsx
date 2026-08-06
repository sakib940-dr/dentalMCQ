import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function FaqForm({ initial, onSaved, onCancel }) {
  const [question, setQuestion] = useState(initial?.question || '');
  const [answer, setAnswer] = useState(initial?.answer || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!question.trim() || !answer.trim()) { setError('প্রশ্ন ও উত্তর দুটোই দিতে হবে।'); return; }
    setSaving(true);
    const { error: saveError } = initial?.id
      ? await supabase.from('faqs').update({ question: question.trim(), answer: answer.trim() }).eq('id', initial.id)
      : await supabase.from('faqs').insert({ question: question.trim(), answer: answer.trim(), display_order: initial?.display_order ?? 0 });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    onSaved();
  };

  return (
    <form className="exam-form-fields" onSubmit={submit} style={{ marginTop: 12 }}>
      <label>
        <span>প্রশ্ন</span>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="যেমন: প্যাকেজ কেনার পর কতক্ষণে অ্যাক্সেস পাব?" />
      </label>
      <label>
        <span>উত্তর</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} />
      </label>
      {error && <div className="error-box">{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn-primary sm" disabled={saving}>{saving ? 'সেভ হচ্ছে…' : 'সেভ'}</button>
        <button type="button" className="btn-secondary sm" onClick={onCancel}>বাতিল</button>
      </div>
    </form>
  );
}

export default function FaqAdminPage() {
  const [faqs, setFaqs] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('faqs').select('*').order('display_order');
    setFaqs(data || []);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (f) => {
    setFaqs((fs) => fs.map((x) => (x.id === f.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from('faqs').update({ is_active: !f.is_active }).eq('id', f.id);
  };
  const remove = async (f) => {
    if (!confirm(`"${f.question}" মুছে ফেলতে চান?`)) return;
    await supabase.from('faqs').delete().eq('id', f.id);
    load();
  };
  const move = async (index, dir) => {
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= faqs.length) return;
    const a = faqs[index], b = faqs[swapWith];
    await Promise.all([
      supabase.from('faqs').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('faqs').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    load();
  };

  if (faqs === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>FAQ</h2>
      <p className="muted small">হোমপেজে যেসব সাধারণ প্রশ্ন-উত্তর দেখাতে চান, এখান থেকে ম্যানেজ করুন।</p>

      {!adding && <button className="btn-primary sm" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>+ নতুন FAQ যোগ করুন</button>}
      {adding && <FaqForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}

      <div className="recent-list" style={{ marginTop: 16 }}>
        {faqs.map((f, i) => (
          <div key={f.id}>
            {editingId === f.id ? (
              <FaqForm initial={f} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
            ) : (
              <div className="recent-row">
                <div>
                  <span className="recent-name">{f.question}</span>
                  {!f.is_active && <span className="status-pill status-archived" style={{ marginLeft: 8 }}>Hidden</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-secondary sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button className="btn-secondary sm" onClick={() => move(i, 1)} disabled={i === faqs.length - 1}>↓</button>
                  <button className="btn-secondary sm" onClick={() => setEditingId(f.id)}>এডিট</button>
                  <button className="btn-secondary sm" onClick={() => toggleActive(f)}>{f.is_active ? 'লুকান' : 'দেখান'}</button>
                  <button className="btn-danger sm" onClick={() => remove(f)}>ডিলিট</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {faqs.length === 0 && <p className="muted small">এখনো কোনো FAQ যোগ করা হয়নি।</p>}
    </div>
  );
}

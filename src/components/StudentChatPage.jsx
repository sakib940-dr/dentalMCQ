import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fmtDateTime as fmtTime } from '../lib/formatters';
import { IconPaperclip } from '../lib/examineeIcons';


const MAX_ATTACHMENT_BYTES = 500 * 1024; // 500KB

export default function StudentChatPage() {
  const { user } = useAuth();
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachError, setAttachError] = useState('');
  const bottomRef = useRef(null);

  const ensureThread = useCallback(async () => {
    const { data: existing } = await supabase.from('chat_threads').select('*').eq('student_id', user.id).maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase.from('chat_threads').insert({ student_id: user.id }).select().single();
    if (error) {
      console.error('Failed to create chat thread:', error.message);
      return null;
    }
    return created.id;
  }, [user.id]);

  const loadMessages = useCallback(async (tid) => {
    const { data } = await supabase.from('chat_messages').select('*').eq('thread_id', tid).order('created_at', { ascending: true });
    setMessages(data || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const tid = await ensureThread();
      if (cancelled || !tid) { setLoading(false); return; }
      setThreadId(tid);
      await loadMessages(tid);
      setLoading(false);

      // Mark staff messages as read by the student
      await supabase.from('chat_messages').update({ read_by_student: true }).eq('thread_id', tid).neq('sender_role', 'examinee');

      // Also clear the matching notification rows — the unread badge on
      // the bottom nav's Messages tab is driven entirely by
      // notifications.is_read, and without this, it only ever got
      // cleared by opening the 🔔 bell dropdown, not by actually reading
      // the messages through the primary Messages tab.
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('type', 'chat_message').eq('is_read', false);
    }
    init();
    return () => { cancelled = true; };
  }, [ensureThread, loadMessages, user.id]);

  // Live updates via Supabase Realtime
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`chat_thread_${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
        setMessages((m) => [...m, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !threadId) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_role: 'examinee',
      body: text.trim(),
    });
    setSending(false);
    if (!error) setText('');
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !threadId) return;
    setAttachError('');

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setAttachError('Only JPG or PNG images are allowed.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError('Image is too large — max 500KB.');
      return;
    }

    setSending(true);
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const path = `${threadId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file, { contentType: file.type });
    if (uploadError) {
      setSending(false);
      setAttachError(uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);

    const { error } = await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender_id: user.id,
      sender_role: 'examinee',
      attachment_url: urlData.publicUrl,
    });
    setSending(false);
    if (error) setAttachError(error.message);
  };

  if (loading) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel chat-page">
      <h2>Message the examiner</h2>
      <p className="muted small">Questions, password help, or anything about your exams — the admin and moderator team will reply here.</p>

      <div className="chat-thread">
        {messages.length === 0 && <div className="muted" style={{ padding: '20px 0' }}>No messages yet. Say hello below.</div>}
        {messages.map((m) => (
          <div key={m.id} className={m.sender_role === 'examinee' ? 'chat-bubble chat-bubble-mine' : 'chat-bubble chat-bubble-theirs'}>
            {m.sender_role !== 'examinee' && (
              <div className="chat-bubble-sender">
                {m.sender_role === 'super_admin' ? 'Admin' : m.sender_role === 'admin' ? 'Admin' : 'Moderator'}
              </div>
            )}
            {m.attachment_url && (
              <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                <img src={m.attachment_url} alt="Attachment" className="chat-bubble-image" />
              </a>
            )}
            {m.body && <div className="chat-bubble-text">{m.body}</div>}
            <div className="chat-bubble-time">{fmtTime(m.created_at)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {attachError && <div className="error-box" style={{ marginBottom: 8 }}>{attachError}</div>}

      <form className="chat-input-row" onSubmit={send}>
        <label className="chat-attach-btn">
          <IconPaperclip size={18} />
          <input type="file" accept="image/jpeg,image/png" onChange={sendImage} disabled={sending} style={{ display: 'none' }} />
        </label>
        <input
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
        />
        <button type="submit" className="chat-send-btn" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

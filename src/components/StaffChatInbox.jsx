import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { fmtDateTime as fmtTime } from '../lib/formatters';


const MAX_ATTACHMENT_BYTES = 500 * 1024; // 500KB

function ThreadList({ onOpen }) {
  const [threads, setThreads] = useState(null);

  const load = useCallback(async () => {
    const { data: threadRows } = await supabase.from('chat_threads').select('*, profiles!chat_threads_student_id_fkey(full_name, username)').order('last_message_at', { ascending: false });
    if (!threadRows) { setThreads([]); return; }

    // For each thread, get the last visible message + unread count (RLS already filters what this role can see)
    const enriched = await Promise.all(threadRows.map(async (t) => {
      const { data: lastMsgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', t.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const { count: unread } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('thread_id', t.id)
        .eq('sender_role', 'examinee')
        .eq('read_by_staff', false);
      return { ...t, lastMessage: lastMsgs?.[0] || null, unread: unread || 0 };
    }));

    // Threads with no visible messages yet (e.g. moderator viewing a thread
    // where the only message was from super_admin) still show, just empty.
    setThreads(enriched);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (threads === null) return <div className="panel"><p className="muted">Loading…</p></div>;

  return (
    <div className="panel">
      <h2>Inbox</h2>
      {threads.length === 0 && <div className="muted">No student messages yet.</div>}
      <div className="chat-thread-list">
        {threads.map((t) => (
          <button key={t.id} className="chat-thread-row" onClick={() => onOpen(t)}>
            <div className="chat-thread-row-left">
              <div className="chat-thread-row-name">
                {t.profiles?.full_name || 'Student'}
                {t.unread > 0 && <span className="unread-dot" />}
              </div>
              <div className="chat-thread-row-preview">
                {t.lastMessage
                  ? (t.lastMessage.body
                      ? t.lastMessage.body.slice(0, 46) + (t.lastMessage.body.length > 46 ? '…' : '')
                      : '📷 Image')
                  : 'No messages yet'}
              </div>
            </div>
            <div className="chat-thread-row-time">{t.lastMessage ? fmtTime(t.lastMessage.created_at) : ''}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ThreadConversation({ thread, onBack }) {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachError, setAttachError] = useState('');
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('chat_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true });
    setMessages(data || []);
    await supabase.from('chat_messages').update({ read_by_staff: true }).eq('thread_id', thread.id).eq('sender_role', 'examinee');
  }, [thread.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`staff_chat_thread_${thread.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${thread.id}` }, (payload) => {
        // RLS already prevents a moderator's subscription from receiving
        // super_admin-authored rows, so no client-side filtering needed.
        setMessages((m) => [...m, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('chat_messages').insert({
      thread_id: thread.id,
      sender_id: user.id,
      sender_role: role,
      body: text.trim(),
    });
    setSending(false);
    if (!error) setText('');
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
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
    const path = `${thread.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file, { contentType: file.type });
    if (uploadError) {
      setSending(false);
      setAttachError(uploadError.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);

    const { error } = await supabase.from('chat_messages').insert({
      thread_id: thread.id,
      sender_id: user.id,
      sender_role: role,
      attachment_url: urlData.publicUrl,
    });
    setSending(false);
    if (error) setAttachError(error.message);
  };

  return (
    <div className="panel chat-page">
      <button className="btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}>← Inbox</button>
      <h2>{thread.profiles?.full_name || 'Student'}</h2>
      <p className="muted small">{thread.profiles?.username}</p>

      <div className="chat-thread">
        {messages.length === 0 && <div className="muted" style={{ padding: '20px 0' }}>No messages in this thread yet.</div>}
        {messages.map((m) => (
          <div key={m.id} className={m.sender_role !== 'examinee' ? 'chat-bubble chat-bubble-mine' : 'chat-bubble chat-bubble-theirs'}>
            <div className="chat-bubble-sender">
              {m.sender_role === 'examinee' ? 'Student'
                : m.sender_role === 'super_admin' ? 'Super Admin'
                : m.sender_role === 'admin' ? 'Admin'
                : 'Moderator'}
            </div>
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
          📎
          <input type="file" accept="image/jpeg,image/png" onChange={sendImage} disabled={sending} style={{ display: 'none' }} />
        </label>
        <input className="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply…" />
        <button type="submit" className="chat-send-btn" disabled={sending || !text.trim()}>Send</button>
      </form>
    </div>
  );
}

export default function StaffChatInbox() {
  const [activeThread, setActiveThread] = useState(null);

  if (activeThread) {
    return <ThreadConversation thread={activeThread} onBack={() => setActiveThread(null)} />;
  }
  return <ThreadList onOpen={setActiveThread} />;
}

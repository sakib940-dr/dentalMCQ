import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ICONS = {
  payment_approved: '✅',
  payment_rejected: '⚠️',
  chat_message: '💬',
  exam_published: '📝',
  expiry_warning: '⏰',
};

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef(null);

  const load = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data || []);
    setUnreadCount((data || []).filter((n) => !n.is_read).length);
  };

  useEffect(() => {
    load();
    supabase.rpc('check_and_notify_expiring_grants').then(() => load());

    const channel = supabase
      .channel(`notifications_${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    load();
  };

  const handleClick = async (n) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      load();
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="notif-bell-root" ref={rootRef}>
      <button className="notif-bell-btn" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && <button className="notif-mark-read-btn" onClick={markAllRead}>Mark all read</button>}
          </div>
          <div className="notif-dropdown-list">
            {notifications.length === 0 && <div className="notif-empty">No notifications yet.</div>}
            {notifications.map((n) => (
              <button key={n.id} className={n.is_read ? 'notif-row' : 'notif-row notif-row-unread'} onClick={() => handleClick(n)}>
                <span className="notif-row-icon">{ICONS[n.type] || '🔔'}</span>
                <span className="notif-row-body">
                  <span className="notif-row-title">{n.title}</span>
                  {n.body && <span className="notif-row-text">{n.body}</span>}
                  <span className="notif-row-time">{timeAgo(n.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

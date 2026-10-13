import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';

export default function NotificationsDropdown() {
  const { user } = useAuth();
  const { openChat } = useChat();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    const token = localStorage.getItem('accessToken');
    if (!user || !token) return;
    try {
      const res = await fetchApi('/collaboration/notifications');
      if (res && res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch {
      // silent on 401 or network drop
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!user || !token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 12000);
    return () => clearInterval(interval);
  }, [user]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = async () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && unreadCount > 0) {
      try {
        await fetchApi('/collaboration/notifications/all/read', { method: 'PUT' });
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      } catch {/* silent */}
    }
  };

  const handleNotifClick = (n: any) => {
    setOpen(false);
    // If notification is a chat message, open the unified chat overlay
    if (n.type === 'CHAT' || n.title?.toLowerCase().includes('message') || n.link?.startsWith('/chat/')) {
      const partnerId = n.link?.startsWith('/chat/') ? n.link.replace('/chat/', '') : undefined;
      const partnerName = n.title?.replace('Message from ', '');
      openChat(partnerId ? { id: partnerId, name: partnerName } : undefined);
      return;
    }
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="p-2 bg-white/50 rounded-full hover:bg-white/80 transition relative"
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-[200] max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-slate-100 font-bold text-sm flex justify-between items-center">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">{notifications.length} total</span>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              <div className="text-2xl mb-2">🔕</div>
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition ${
                  !n.isRead ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="font-semibold text-xs text-slate-700">{n.title}</div>
                  <div className="text-[10px] text-slate-400 shrink-0">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{n.message}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

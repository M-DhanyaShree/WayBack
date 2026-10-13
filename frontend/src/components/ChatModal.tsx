import { useState, useEffect, useRef } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ChatModalProps {
  partnerId: string;
  partnerName: string;
  tripId: string;
  onClose: () => void;
}

export default function ChatModal({ partnerId, partnerName, tripId, onClose }: ChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetchApi(`/collaboration/messages/trip/${tripId}`);
      // Filter out messages only between current user and partner, just in case
      const filtered = (res.data.messages || []).filter(
        (m: any) =>
          (m.senderId === user?.id && m.receiverId === partnerId) ||
          (m.senderId === partnerId && m.receiverId === user?.id)
      );
      setMessages(filtered.reverse());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Simple polling
    return () => clearInterval(interval);
  }, [tripId, partnerId, user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    setSending(true);
    try {
      await fetchApi('/collaboration/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: partnerId,
          tripId,
          content,
        }),
      });
      setContent('');
      await fetchMessages();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/40 flex flex-col h-[600px] max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white/80 border-b border-slate-200 p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
              {partnerName.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-foreground">{partnerName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Online
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
            ✖
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-10">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === user?.id;
              return (
                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] p-3 rounded-2xl ${
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-white border border-slate-200 text-foreground rounded-tl-sm shadow-sm'
                    }`}
                  >
                    <div className="text-sm">{m.content}</div>
                    <div className={`text-[10px] mt-1 text-right ${isMine ? 'text-primary-foreground/70' : 'text-slate-400'}`}>
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="bg-white/90 p-3 border-t border-slate-200 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 bg-slate-100 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={!content.trim() || sending}
              className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition shadow-md"
            >
              ➤
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

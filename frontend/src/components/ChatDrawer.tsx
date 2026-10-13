import { useState, useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';

export default function ChatDrawer() {
  const { isOpen, closeChat, activePartner, setActivePartner, refreshUnread } = useChat();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation list when opened and no active partner
  const loadConversations = async () => {
    setLoadingConv(true);
    try {
      const res = await fetchApi('/collaboration/conversations');
      setConversations(res.data?.conversations || []);
    } catch {
      // silent
    } finally {
      setLoadingConv(false);
    }
  };

  // Load messages for the active partner
  const loadMessages = async (partnerId: string) => {
    try {
      const res = await fetchApi(`/collaboration/messages/partner/${partnerId}`);
      setMessages(res.data?.messages || []);
      refreshUnread();
    } catch {
      // silent
    } finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (activePartner) {
      setLoadingMsgs(true);
      loadMessages(activePartner.id);
      const interval = setInterval(() => loadMessages(activePartner.id), 3500);
      return () => clearInterval(interval);
    } else {
      loadConversations();
    }
  }, [isOpen, activePartner]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (activePartner && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activePartner]);

  const handleSend = async (customText?: string) => {
    const content = (customText || text).trim();
    if (!content || !activePartner || sending) return;

    setSending(true);
    // Optimistic message append
    const tempMsg = {
      id: 'temp_' + Date.now(),
      senderId: user?.id,
      receiverId: activePartner.id,
      content,
      createdAt: new Date().toISOString(),
      sender: { id: user?.id, name: user?.name, role: user?.role },
    };
    setMessages((prev) => [...prev, tempMsg]);
    setText('');

    try {
      await fetchApi('/collaboration/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: activePartner.id,
          tripId: activePartner.tripId || null,
          content,
        }),
      });
      loadMessages(activePartner.id);
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.partnerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      {/* Dim Backdrop */}
      <div
        onClick={closeChat}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over Direct Chat Overlay */}
      <div className="relative w-full sm:w-[420px] h-full bg-slate-100 flex flex-col shadow-2xl z-10 border-l border-slate-300 animate-in slide-in-from-right duration-200">
        
        {/* ── Direct Chat Header ────────────────────────────────────── */}
        <div className="bg-[#075e54] text-white p-3.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            {activePartner ? (
              <>
                <button
                  onClick={() => setActivePartner(null)}
                  className="p-1 hover:bg-white/20 rounded-full transition text-lg"
                  title="Back to conversation list"
                >
                  ←
                </button>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-base">
                  {activePartner.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-sm leading-tight">{activePartner.name}</div>
                  <div className="text-[11px] text-emerald-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {activePartner.role === 'DRIVER' ? 'Verified Driver' : 'Customer'} • Online
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl">💬</span>
                <div>
                  <div className="font-bold text-base">WayBack Messenger</div>
                  <div className="text-[11px] text-emerald-200">Instant Driver & Customer Chat</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={closeChat}
            className="p-1.5 hover:bg-white/20 rounded-full transition font-bold text-lg leading-none"
            title="Close Chat"
          >
            ✕
          </button>
        </div>

        {/* ── Body: Either Conversation List or Chat Thread ──────── */}
        {activePartner ? (
          <>
            {/* Quick Context & Actions Pill Bar */}
            <div className="bg-white/90 border-b border-slate-200 px-3 py-2 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
              <button
                onClick={() => handleSend('📍 Sharing my live location: In transit towards delivery destination.')}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full font-semibold border border-emerald-200 shrink-0 transition"
              >
                📍 Share Location
              </button>
              <button
                onClick={() => handleSend('🚚 On the way! Goods are safely loaded and secured.')}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-full font-semibold border border-blue-200 shrink-0 transition"
              >
                🚚 Status Update
              </button>
              <button
                onClick={() => handleSend('💳 Payment received. Thank you!')}
                className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-full font-semibold border border-purple-200 shrink-0 transition"
              >
                💳 Payment Ack
              </button>
            </div>

            {/* Message Stream */}
            <div
              className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#e5ddd5]/60"
              style={{
                backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
              }}
            >
              {loadingMsgs && (
                <div className="text-center text-xs text-slate-500 py-4">Loading messages...</div>
              )}

              {messages.length === 0 && !loadingMsgs && (
                <div className="text-center py-10 px-4 text-slate-500 text-xs bg-white/70 rounded-2xl mx-auto max-w-[280px] shadow-xs">
                  <div className="text-2xl mb-1">🔒</div>
                  Messages are end-to-end coordinated between driver and customer for shipment security.
                </div>
              )}

              {messages.map((m) => {
                const isMe = m.senderId === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-xs shadow-xs relative ${
                        isMe
                          ? 'bg-[#dcf8c6] text-slate-900 rounded-tr-xs'
                          : 'bg-white text-slate-900 rounded-tl-xs border border-slate-200'
                      }`}
                    >
                      <div className="leading-relaxed break-words whitespace-pre-wrap">{m.content}</div>
                      <div className="text-[9px] text-slate-400 text-right mt-1 font-mono">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && <span className="ml-1 text-emerald-600">✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-[#f0f2f5] border-t border-slate-300 flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                autoFocus
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-full text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#075e54]/50 shadow-xs"
              />
              <button
                onClick={() => handleSend()}
                disabled={!text.trim() || sending}
                className="w-10 h-10 rounded-full bg-[#128c7e] hover:bg-[#075e54] text-white flex items-center justify-center font-bold text-base shadow-sm transition disabled:opacity-40 shrink-0"
                title="Send Message"
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          /* ── Conversation List View ──────────────────────────────── */
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#075e54]"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingConv && (
                <div className="p-6 text-center text-xs text-slate-500">Loading conversations...</div>
              )}

              {!loadingConv && filteredConversations.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <div className="text-3xl mb-2">💬</div>
                  No active conversations yet.
                  <p className="mt-1 text-slate-400">
                    When you accept a load or interact on a trip, your direct chat channel opens here.
                  </p>
                </div>
              )}

              {filteredConversations.map((c) => (
                <div
                  key={c.partnerId}
                  onClick={() =>
                    setActivePartner({
                      id: c.partnerId,
                      name: c.partnerName,
                      role: c.partnerRole,
                      tripId: c.tripId,
                    })
                  }
                  className="p-3.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition gap-3"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-sm">
                    {c.partnerName?.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900 truncate">{c.partnerName}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{c.lastMessage}</div>
                  </div>

                  {c.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

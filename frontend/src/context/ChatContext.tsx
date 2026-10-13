import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from './AuthContext';

export interface ChatPartner {
  id: string;
  name: string;
  role?: string;
  tripId?: string;
}

interface ChatContextType {
  isOpen: boolean;
  activePartner: ChatPartner | null;
  unreadTotal: number;
  openChat: (partner?: ChatPartner) => void;
  closeChat: () => void;
  setActivePartner: (partner: ChatPartner | null) => void;
  refreshUnread: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activePartner, setActivePartner] = useState<ChatPartner | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const refreshUnread = async () => {
    const token = localStorage.getItem('accessToken');
    if (!user || !token) return;
    try {
      const res = await fetchApi('/collaboration/conversations');
      if (res.data?.conversations) {
        const total = res.data.conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
        setUnreadTotal(total);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const openChat = (partner?: ChatPartner) => {
    if (partner) {
      setActivePartner(partner);
    }
    setIsOpen(true);
  };

  const closeChat = () => {
    setIsOpen(false);
    refreshUnread();
  };

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        activePartner,
        unreadTotal,
        openChat,
        closeChat,
        setActivePartner,
        refreshUnread,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

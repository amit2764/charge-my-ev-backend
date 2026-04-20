import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import api from '../api';

const CHAT_ENABLED_STATUSES = new Set(['BOOKED', 'CONFIRMED', 'STARTED']);

export default function useChat(booking, myUserId) {
  const bookingId = booking?.id || null;
  const status = String(booking?.status || '').toUpperCase();
  const canChat = !!bookingId && CHAT_ENABLED_STATUSES.has(status);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingId) {
      setMessages([]);
      return undefined;
    }

    setLoading(true);
    const q = query(collection(db, 'bookings', bookingId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(next);
        setLoading(false);
      },
      () => {
        setError('Failed to load chat updates.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [bookingId]);

  const unreadCount = useMemo(() => {
    return messages.filter((m) => m.senderId !== myUserId && !m.readAt).length;
  }, [messages, myUserId]);

  const markRead = async () => {
    if (!bookingId || !myUserId) return;
    const unread = messages.filter((m) => m.senderId !== myUserId && !m.readAt);
    if (!unread.length) return;

    const batch = writeBatch(db);
    unread.forEach((m) => {
      batch.update(doc(db, 'bookings', bookingId, 'messages', m.id), { readAt: serverTimestamp() });
    });
    await batch.commit();
  };

  const sendMessage = async (text) => {
    if (!canChat) {
      throw new Error('Chat is disabled for this booking status');
    }
    if (!bookingId || !myUserId) {
      throw new Error('No active booking for chat');
    }

    setSending(true);
    setError('');
    try {
      await api.post(`/api/bookings/${bookingId}/messages`, {
        senderId: myUserId,
        text
      });
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Failed to send message';
      setError(msg);
      throw e;
    } finally {
      setSending(false);
    }
  };

  return {
    canChat,
    messages,
    loading,
    sending,
    error,
    unreadCount,
    sendMessage,
    markRead
  };
}

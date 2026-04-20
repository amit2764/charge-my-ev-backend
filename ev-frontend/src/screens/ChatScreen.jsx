import { useEffect } from 'react';
import useChat from '../hooks/useChat';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import { resolveBookingState } from '../resolveBookingState';

export default function ChatScreen({ booking, myUserId, onClose }) {
  const { canChat, messages, loading, sending, error, sendMessage, markRead } = useChat(booking, myUserId);

  useEffect(() => {
    const resolved = resolveBookingState(booking, myUserId);
    const status = String(booking?.status || '').toUpperCase();
    const allowed = status === 'BOOKED' || status === 'CONFIRMED' || status === 'STARTED';
    if (!allowed || resolved.screen === 'HOME') {
      onClose?.();
    }
  }, [booking, myUserId, onClose]);

  useEffect(() => {
    void markRead();
  }, [messages.length]);

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94))]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.6rem)] backdrop-blur-md">
        <div>
          <p className="text-sm font-bold text-white">Booking Chat</p>
          <p className="text-xs text-gray-400">{booking?.id || '-'}</p>
        </div>
        <button onClick={onClose} className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300 hover:bg-white/10">Close</button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && <p className="text-xs text-cyan-300">Loading messages...</p>}
        {!loading && messages.length === 0 && <p className="text-xs text-gray-500">No messages yet.</p>}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} isMine={m.senderId === myUserId} />
        ))}
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>

      <ChatInput disabled={!canChat} sending={sending} onSend={sendMessage} />
    </div>
  );
}

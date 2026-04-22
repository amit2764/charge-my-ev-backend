export default function ChatBubble({ message, isMine }) {
  const created = message?.createdAt?.toDate ? message.createdAt.toDate() : (message?.createdAt ? new Date(message.createdAt) : null);
  const time = created ? created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-[18px] px-3 py-2 text-sm shadow-[0_12px_24px_rgba(2,6,23,0.24)] ${isMine ? 'bg-gradient-to-r from-blue-500 to-cyan-300 text-slate-950' : 'border border-white/10 bg-slate-800/90 text-gray-100'}`}>
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <p className={`mt-1 text-[10px] ${isMine ? 'text-slate-800/75' : 'text-gray-400'}`}>{time}</p>
      </div>
    </div>
  );
}

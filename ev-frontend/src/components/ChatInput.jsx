import { useState } from 'react';

const MAX_LEN = 500;

export default function ChatInput({ disabled, sending, onSend }) {
  const [text, setText] = useState('');

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;
    await onSend(trimmed.slice(0, MAX_LEN));
    setText('');
  };

  return (
    <div className="border-t border-white/10 bg-slate-950/50 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.7rem)] pt-3 backdrop-blur-md">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          disabled={disabled || sending}
          placeholder={disabled ? 'Chat unavailable for this booking status' : 'Type a message...'}
          className="flex-1 rounded-[16px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
        />
        <button
          onClick={() => void submit()}
          disabled={disabled || sending || !text.trim()}
          className="rounded-[16px] bg-gradient-to-r from-blue-500 to-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 shadow-[0_12px_26px_rgba(59,130,246,0.26)] disabled:opacity-50"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
      <p className="mt-1 text-right text-[10px] text-gray-500">{text.length}/{MAX_LEN}</p>
    </div>
  );
}

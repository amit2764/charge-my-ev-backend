import React from 'react';

export default function NotificationPrefRow({
  label,
  description,
  checked,
  disabled = false,
  loading = false,
  onChange
}) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${disabled ? 'border-gray-700 bg-gray-900/40' : 'border-gray-800 bg-gray-900/60'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          {description ? <p className="text-xs text-gray-400">{description}</p> : null}
        </div>

        <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={!!checked}
            disabled={disabled || loading}
            onChange={(event) => onChange?.(event.target.checked)}
          />
          <div className="h-6 w-11 rounded-full bg-gray-700 transition-colors peer-checked:bg-cyan-500" />
          <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
        </label>
      </div>
    </div>
  );
}

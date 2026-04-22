import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

export default function PinInput({ length = 4, value = '', onChange, onComplete, error = false, disabled = false, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;
  const refs = useRef([]);

  const digits = String(value || '').slice(0, length).split('');
  while (digits.length < length) digits.push('');

  function emit(nextDigits) {
    const next = nextDigits.join('');
    onChange?.(next);
    if (next.length >= length) onComplete?.(next.slice(0, length));
  }

  return (
    <>
      <style>{`
        @keyframes pin-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 10, animation: error ? 'pin-shake 300ms linear' : 'none', ...style }}>
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(node) => {
              refs.current[idx] = node;
            }}
            value={digit}
            disabled={disabled}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '').slice(-1);
              const next = [...digits];
              next[idx] = d;
              emit(next);
              if (d && idx < length - 1) refs.current[idx + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[idx] && idx > 0) refs.current[idx - 1]?.focus();
            }}
            style={{
              width: 48,
              height: 52,
              borderRadius: radius.sm,
              border: `1px solid ${error ? colors.error : colors.borderStrong}`,
              background: colors.surface,
              color: colors.text,
              textAlign: 'center',
              fontSize: typography.size.xl,
              outline: 'none',
            }}
          />
        ))}
      </div>
    </>
  );
}

PinInput.propTypes = {
  length: PropTypes.number,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  error: PropTypes.bool,
  disabled: PropTypes.bool,
  style: PropTypes.object,
};

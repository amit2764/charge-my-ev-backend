import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

export function Input({
  label,
  hint,
  error,
  iconLeft,
  iconRight,
  disabled = false,
  loading = false,
  style,
  inputStyle,
  ...rest
}) {
  const { tokens } = useTheme();
  const { colors, radius, typography, shadows } = tokens;
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.error : focused ? colors.brandPrimary : colors.border;

  return (
    <div style={{ display: 'grid', gap: 6, ...style }}>
      {label && <label style={{ fontSize: typography.size.sm, color: colors.textMuted }}>{label}</label>}
      <div
        style={{
          minHeight: 46,
          borderRadius: radius.sm,
          border: `1px solid ${borderColor}`,
          background: colors.surface,
          display: 'grid',
          gridTemplateColumns: `${iconLeft ? 'auto ' : ''}1fr${iconRight || loading ? ' auto' : ''}`,
          gap: 8,
          alignItems: 'center',
          padding: '0 12px',
          opacity: disabled ? 0.6 : 1,
          boxShadow: focused ? shadows.focus : 'none',
          transition: 'box-shadow 120ms, border-color 120ms',
        }}
      >
        {iconLeft && <span style={{ color: colors.textSoft }}>{iconLeft}</span>}
        <input
          disabled={disabled || loading}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: colors.text,
            fontSize: typography.size.md,
            fontFamily: typography.family.sans,
            ...inputStyle,
          }}
          {...rest}
        />
        {(iconRight || loading) && (
          <span style={{ color: colors.textSoft }}>{loading ? '…' : iconRight}</span>
        )}
      </div>
      {(hint || error) && (
        <span style={{ color: error ? colors.error : colors.textSoft, fontSize: typography.size.sm }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

export function PhoneInput({ value = '', onChange, ...props }) {
  const clean = String(value || '').replace(/\D/g, '').slice(0, 10);
  return (
    <Input
      value={clean}
      onChange={(e) => onChange?.(e.target.value.replace(/\D/g, '').slice(0, 10))}
      inputMode="numeric"
      iconLeft="+91"
      {...props}
    />
  );
}

export function OtpInput({ length = 6, value = '', onChange, onComplete, error = false, disabled = false, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;
  const refs = useRef([]);
  const [focused, setFocused] = useState(-1);

  const digits = String(value || '').slice(0, length).split('');
  while (digits.length < length) digits.push('');

  function updateAt(idx, nextDigit) {
    const copy = [...digits];
    copy[idx] = nextDigit;
    const next = copy.join('');
    onChange?.(next);
    if (next.replace(/\s/g, '').length >= length) {
      onComplete?.(next.slice(0, length));
    }
  }

  return (
    <>
      <style>{`
        @keyframes input-shake {
          0%,100% { transform: translateX(0); }
          16% { transform: translateX(-8px); }
          33% { transform: translateX(8px); }
          50% { transform: translateX(-8px); }
          66% { transform: translateX(8px); }
          83% { transform: translateX(-8px); }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 8, animation: error ? 'input-shake 300ms linear' : 'none', ...style }}>
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(node) => {
              refs.current[idx] = node;
            }}
            value={digit}
            disabled={disabled}
            onFocus={() => setFocused(idx)}
            onBlur={() => setFocused(-1)}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '').slice(-1);
              updateAt(idx, d);
              if (d && idx < length - 1) refs.current[idx + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
                refs.current[idx - 1]?.focus();
              }
            }}
            inputMode="numeric"
            maxLength={1}
            style={{
              width: 44,
              height: 50,
              borderRadius: radius.sm,
              border: `1px solid ${error ? colors.error : focused === idx ? colors.brandPrimary : colors.border}`,
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

Input.propTypes = {
  label: PropTypes.node,
  hint: PropTypes.node,
  error: PropTypes.node,
  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  style: PropTypes.object,
  inputStyle: PropTypes.object,
};

PhoneInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
};

OtpInput.propTypes = {
  length: PropTypes.number,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  error: PropTypes.bool,
  disabled: PropTypes.bool,
  style: PropTypes.object,
};

export default Input;

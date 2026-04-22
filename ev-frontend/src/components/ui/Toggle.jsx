import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

export default function Toggle({ checked = false, onChange, disabled = false, label, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, opacity: disabled ? 0.6 : 1, ...style }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        style={{
          width: 44,
          height: 26,
          borderRadius: radius.full,
          border: 'none',
          padding: 3,
          background: checked ? colors.brandPrimary : colors.borderStrong,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 140ms',
        }}
      >
        <span
          style={{
            display: 'block',
            width: 20,
            height: 20,
            borderRadius: radius.full,
            background: colors.surface,
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
            transition: 'transform 140ms',
          }}
        />
      </button>
      {label && <span style={{ fontSize: typography.size.md, color: colors.text }}>{label}</span>}
    </label>
  );
}

Toggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  label: PropTypes.node,
  style: PropTypes.object,
};

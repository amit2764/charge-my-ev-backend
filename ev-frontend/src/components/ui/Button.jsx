import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

const SIZES = {
  sm: { minHeight: 36, padding: '0 12px', fontSize: 12 },
  md: { minHeight: 44, padding: '0 16px', fontSize: 14 },
  lg: { minHeight: 52, padding: '0 20px', fontSize: 16 },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  fullWidth = false,
  iconLeft = null,
  iconRight = null,
  onClick,
  style,
  ...rest
}) {
  const { tokens } = useTheme();
  const { colors, radius, typography, shadows } = tokens;
  const [pressed, setPressed] = useState(false);

  const isDisabled = disabled || loading;
  const sizeToken = SIZES[size] || SIZES.md;

  const variants = {
    primary: {
      background: colors.brandPrimary,
      color: colors.surfaceInverse,
      border: 'none',
    },
    secondary: {
      background: colors.surface,
      color: colors.brandPrimary,
      border: `1px solid ${colors.brandPrimary}`,
    },
    ghost: {
      background: 'transparent',
      color: colors.text,
      border: `1px solid ${colors.border}`,
    },
    danger: {
      background: colors.error,
      color: colors.surfaceInverse,
      border: 'none',
    },
    success: {
      background: colors.success,
      color: colors.surfaceInverse,
      border: 'none',
    },
  };

  const tone = variants[variant] || variants.primary;

  return (
    <>
      <style>{`@keyframes ui-spin{to{transform:rotate(360deg)}}`}</style>
      <button
        type={type}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          minHeight: sizeToken.minHeight,
          padding: sizeToken.padding,
          borderRadius: radius.full,
          fontFamily: typography.family.sans,
          fontWeight: typography.weight.semibold,
          fontSize: sizeToken.fontSize,
          letterSpacing: typography.letterSpacing.normal,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: fullWidth ? '100%' : undefined,
          transition: 'transform 100ms cubic-bezier(0.2,0.8,0.2,1), opacity 120ms',
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          boxShadow: variant === 'primary' ? shadows.sm : 'none',
          opacity: isDisabled ? 0.56 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          ...tone,
          ...style,
        }}
        {...rest}
      >
        {!loading && iconLeft}
        {loading && (
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: radius.full,
              border: `2px solid ${colors.surfaceInverse}`,
              borderBottomColor: 'transparent',
              animation: 'ui-spin 700ms linear infinite',
            }}
          />
        )}
        <span>{children}</span>
        {!loading && iconRight}
      </button>
    </>
  );
}

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost', 'danger', 'success']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  type: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  fullWidth: PropTypes.bool,
  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,
  onClick: PropTypes.func,
  style: PropTypes.object,
};

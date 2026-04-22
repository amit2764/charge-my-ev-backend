import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

export default function Card({
  children,
  variant = 'default',
  padding = 16,
  onClick,
  style,
  ...rest
}) {
  const { tokens } = useTheme();
  const { colors, radius, shadows } = tokens;
  const [pressed, setPressed] = useState(false);
  const interactive = typeof onClick === 'function';

  const variants = {
    default: {
      border: `1px solid ${colors.border}`,
      background: colors.surface,
      boxShadow: shadows.sm,
    },
    outlined: {
      border: `1px solid ${colors.borderStrong}`,
      background: colors.surface,
      boxShadow: 'none',
    },
    raised: {
      border: `1px solid ${colors.border}`,
      background: colors.surfaceRaised,
      boxShadow: shadows.md,
    },
  };

  return (
    <div
      onClick={onClick}
      onMouseDown={() => interactive && setPressed(true)}
      onMouseUp={() => interactive && setPressed(false)}
      onMouseLeave={() => interactive && setPressed(false)}
      onTouchStart={() => interactive && setPressed(true)}
      onTouchEnd={() => interactive && setPressed(false)}
      style={{
        borderRadius: radius.md,
        padding,
        transition: 'transform 150ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 150ms',
        transform: interactive && pressed ? 'scale(0.98)' : 'scale(1)',
        cursor: interactive ? 'pointer' : 'default',
        ...(variants[variant] || variants.default),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

Card.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'outlined', 'raised']),
  padding: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onClick: PropTypes.func,
  style: PropTypes.object,
};

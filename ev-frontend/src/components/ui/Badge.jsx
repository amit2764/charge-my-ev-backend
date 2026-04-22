import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

export default function Badge({ variant = 'neutral', size = 'md', dot = false, children, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  const variants = {
    neutral: { bg: colors.surfaceRaised, color: colors.textMuted, marker: colors.textMuted },
    success: { bg: colors.successSoft, color: colors.success, marker: colors.success },
    warning: { bg: colors.warningSoft, color: colors.warning, marker: colors.warning },
    error: { bg: colors.errorSoft, color: colors.error, marker: colors.error },
    info: { bg: colors.infoSoft, color: colors.info, marker: colors.info },
    primary: { bg: colors.brandPrimarySoft, color: colors.brandPrimary, marker: colors.brandPrimary },
  };

  const sizes = {
    sm: { fontSize: typography.size.xs, padding: '3px 8px' },
    md: { fontSize: typography.size.sm, padding: '4px 10px' },
  };

  const tone = variants[variant] || variants.neutral;
  const scale = sizes[size] || sizes.md;

  return (
    <span
      style={{
        borderRadius: radius.full,
        background: tone.bg,
        color: tone.color,
        padding: scale.padding,
        fontSize: scale.fontSize,
        fontWeight: typography.weight.semibold,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: radius.full, background: tone.marker }} />
      )}
      {children}
    </span>
  );
}

Badge.propTypes = {
  variant: PropTypes.oneOf(['neutral', 'success', 'warning', 'error', 'info', 'primary']),
  size: PropTypes.oneOf(['sm', 'md']),
  dot: PropTypes.bool,
  children: PropTypes.node,
  style: PropTypes.object,
};

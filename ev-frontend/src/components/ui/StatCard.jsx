import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

function formatValue(value, format) {
  if (typeof format === 'function') return format(value);
  if (format === 'currency') return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-IN') : String(value ?? '-');
}

export default function StatCard({ title, value, delta, icon, format, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography, shadows } = tokens;
  const up = typeof delta === 'number' && delta > 0;
  const down = typeof delta === 'number' && delta < 0;

  return (
    <article
      style={{
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        background: colors.surfaceRaised,
        boxShadow: shadows.sm,
        padding: 14,
        display: 'grid',
        gap: 6,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: typography.size.sm, color: colors.textMuted }}>{title}</div>
        {icon && <div style={{ color: colors.textSoft }}>{icon}</div>}
      </div>
      <div style={{ fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.text }}>
        {formatValue(value, format)}
      </div>
      {typeof delta === 'number' && (
        <div style={{ fontSize: typography.size.sm, color: up ? colors.success : down ? colors.error : colors.textSoft }}>
          {up ? '↑' : down ? '↓' : '•'} {Math.abs(delta)}%
        </div>
      )}
    </article>
  );
}

StatCard.propTypes = {
  title: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  delta: PropTypes.number,
  icon: PropTypes.node,
  format: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  style: PropTypes.object,
};

import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';
import Button from './Button';

export default function EmptyState({ icon = '∅', title, description, actionLabel, onAction, style }) {
  const { tokens } = useTheme();
  const { colors, typography } = tokens;

  return (
    <div
      style={{
        padding: 28,
        textAlign: 'center',
        border: `1px dashed ${colors.borderStrong}`,
        borderRadius: 14,
        background: colors.surface,
        display: 'grid',
        gap: 8,
        justifyItems: 'center',
        ...style,
      }}
    >
      <div style={{ fontSize: 36, color: colors.textSoft }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: typography.size.xl, color: colors.text }}>{title}</h3>
      {description && (
        <p style={{ margin: 0, fontSize: typography.size.md, color: colors.textMuted, maxWidth: 360 }}>{description}</p>
      )}
      {actionLabel && (
        <Button size="sm" variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node,
  description: PropTypes.node,
  actionLabel: PropTypes.node,
  onAction: PropTypes.func,
  style: PropTypes.object,
};

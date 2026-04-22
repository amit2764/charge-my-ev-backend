// Divider component
// Props: label, orientation (horizontal|vertical), style

import React from 'react';
import { useTheme } from '../../hooks/useTheme';

export default function Divider({ label, orientation = 'horizontal', style = {} }) {
  const { colors: c } = useTheme();
  const mode = c.mode;

  if (orientation === 'vertical') {
    return (
      <div
        style={{
          width: '1px',
          alignSelf: 'stretch',
          background: mode.border,
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  if (label) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          ...style,
        }}
      >
        <div style={{ flex: 1, height: '1px', background: mode.border }} />
        <span
          style={{
            fontSize: '12px',
            color: mode.textMuted,
            fontFamily: "'Inter', sans-serif",
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <div style={{ flex: 1, height: '1px', background: mode.border }} />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '1px',
        background: mode.border,
        width: '100%',
        ...style,
      }}
    />
  );
}

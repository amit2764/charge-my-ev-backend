import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

export default function StarRating({ value = 0, outOf = 5, onChange, size = 22, readOnly = false, style }) {
  const { tokens } = useTheme();
  const { colors } = tokens;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', ...style }}>
      {Array.from({ length: outOf }).map((_, i) => {
        const active = i < value;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(i + 1)}
            style={{
              border: 'none',
              background: 'transparent',
              color: active ? colors.warning : colors.textSoft,
              fontSize: size,
              lineHeight: 1,
              cursor: readOnly ? 'default' : 'pointer',
              padding: 0,
            }}
            aria-label={`Rate ${i + 1}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

StarRating.propTypes = {
  value: PropTypes.number,
  outOf: PropTypes.number,
  onChange: PropTypes.func,
  size: PropTypes.number,
  readOnly: PropTypes.bool,
  style: PropTypes.object,
};

import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

const SIZES = {
  sm: 32,
  md: 44,
  lg: 60,
  xl: 80,
};

export default function Avatar({ src = '', name = '', size = 'md', status = null, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;
  const [failed, setFailed] = useState(false);

  const dimension = SIZES[size] || SIZES.md;
  const initials = useMemo(() => {
    const parts = String(name).split(' ').filter(Boolean).slice(0, 2);
    return parts.map((p) => p[0]).join('').toUpperCase() || '?';
  }, [name]);

  const statusColor = {
    online: colors.success,
    busy: colors.warning,
    offline: colors.textSoft,
  }[status] || colors.success;

  return (
    <div style={{ position: 'relative', width: dimension, height: dimension, ...style }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: radius.full,
          overflow: 'hidden',
          border: `1px solid ${colors.borderStrong}`,
          background: colors.brandPrimarySoft,
          display: 'grid',
          placeItems: 'center',
          color: colors.brandPrimary,
          fontWeight: typography.weight.heavy,
          fontSize: Math.floor(dimension * 0.38),
        }}
      >
        {src && !failed ? (
          <img
            alt={name}
            src={src}
            onError={() => setFailed(true)}
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : initials}
      </div>
      {status && (
        <span
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 11,
            height: 11,
            borderRadius: radius.full,
            background: statusColor,
            border: `2px solid ${colors.surface}`,
          }}
        />
      )}
    </div>
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  status: PropTypes.oneOf(['online', 'busy', 'offline', null]),
  style: PropTypes.object,
};

import React from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../../theme';

function Block({ width, height, borderRadius, style }) {
  const { tokens } = useTheme();
  const { colors } = tokens;

  return (
    <>
      <style>{`
        @keyframes sk-shimmer {
          0% { background-position: -220% 0; }
          100% { background-position: 220% 0; }
        }
      `}</style>
      <div
        style={{
          width,
          height,
          borderRadius,
          background: `linear-gradient(90deg, ${colors.skeletonBase} 20%, ${colors.skeletonHighlight} 50%, ${colors.skeletonBase} 80%)`,
          backgroundSize: '220% 100%',
          animation: 'sk-shimmer 1.2s ease-in-out infinite',
          ...style,
        }}
      />
    </>
  );
}

export default function LoadingSkeleton({ width = '100%', height = 14, radius = 8, lines = 0, circle = false, style }) {
  if (lines > 0) {
    return (
      <div style={{ display: 'grid', gap: 8, ...style }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Block key={i} width={i === lines - 1 ? '70%' : width} height={height} borderRadius={radius} />
        ))}
      </div>
    );
  }

  if (circle) {
    return <Block width={width} height={width} borderRadius="999px" style={style} />;
  }

  return <Block width={width} height={height} borderRadius={radius} style={style} />;
}

export function CardSkeleton({ style }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12, alignItems: 'start', ...style }}>
      <LoadingSkeleton width={40} circle />
      <LoadingSkeleton lines={3} />
    </div>
  );
}

LoadingSkeleton.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  radius: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  lines: PropTypes.number,
  circle: PropTypes.bool,
  style: PropTypes.object,
};

CardSkeleton.propTypes = { style: PropTypes.object };

import React from 'react';
import PropTypes from 'prop-types';
import { View } from 'react-native';
import { useTheme } from '../../theme';

export default function LoadingSkeleton({ width = '100%', height = 14, radius = 8, style }) {
  const { tokens } = useTheme();
  const { colors } = tokens;

  return <View style={[{ width, height, borderRadius: radius, backgroundColor: colors.skeletonBase }, style]} />;
}

export function CardSkeleton({ style }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      <LoadingSkeleton width={44} height={44} radius={22} />
      <LoadingSkeleton width="60%" />
      <LoadingSkeleton width="85%" />
    </View>
  );
}

LoadingSkeleton.propTypes = {
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  radius: PropTypes.number,
  style: PropTypes.object,
};

CardSkeleton.propTypes = { style: PropTypes.object };

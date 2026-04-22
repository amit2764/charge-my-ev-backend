import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '../../theme';

/**
 * ProgressBar — Native
 * Props:
 *  value       (0–100)
 *  variant     teal | violet | success | warning | error
 *  size        sm | md | lg
 *  label       string shown left of value
 *  showValue   show % on the right
 *  animated    smooth width transition (default true)
 *  style
 */
const HEIGHTS = { sm: 4, md: 8, lg: 12 };

export default function ProgressBar({
  value = 0,
  variant = 'teal',
  size = 'md',
  label,
  showValue = false,
  animated = true,
  style,
}) {
  const { tokens, isDark } = useTheme();
  const { colors, typography } = tokens;

  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const height = HEIGHTS[size] ?? HEIGHTS.md;

  const variantColors = {
    teal:    colors.brandPrimary,
    violet:  colors.brandSecondary,
    success: colors.success,
    warning: colors.warning,
    error:   colors.error,
  };
  const fillColor = variantColors[variant] ?? variantColors.teal;
  const trackColor = isDark ? '#232A38' : '#DDE5F0';

  const [widthAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: clamped,
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(clamped);
    }
  }, [clamped, animated]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[{ width: '100%' }, style]}>
      {(label || showValue) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          {label && (
            <Text
              style={{
                fontSize: typography.size.sm,
                color: colors.textMuted,
                fontWeight: String(typography.weight.medium),
              }}
            >
              {label}
            </Text>
          )}
          {showValue && (
            <Text
              style={{
                fontSize: typography.size.sm,
                color: fillColor,
                fontWeight: String(typography.weight.semibold),
              }}
            >
              {clamped}%
            </Text>
          )}
        </View>
      )}

      <View
        style={{
          height,
          borderRadius: 9999,
          backgroundColor: trackColor,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: '100%',
            borderRadius: 9999,
            backgroundColor: fillColor,
            width: animatedWidth,
          }}
        />
      </View>
    </View>
  );
}

ProgressBar.propTypes = {
  value: PropTypes.number,
  variant: PropTypes.oneOf(['teal', 'violet', 'success', 'warning', 'error']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  label: PropTypes.string,
  showValue: PropTypes.bool,
  animated: PropTypes.bool,
  style: PropTypes.object,
};

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Animated, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';

/**
 * Card — Native
 * Variants: default | outlined | raised
 * onPress → interactive with scale(0.98) spring feedback.
 */
export default function Card({
  children,
  variant = 'default',
  padding = 16,
  onPress,
  style,
}) {
  const { tokens } = useTheme();
  const { colors, radius } = tokens;
  const [scale] = useState(() => new Animated.Value(1));
  const interactive = typeof onPress === 'function';

  const variants = {
    default: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    outlined: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
    raised: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  };

  const baseStyle = [
    { borderRadius: radius.md, padding },
    variants[variant] || variants.default,
    style,
  ];

  if (interactive) {
    const onPressIn = () =>
      Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
    const onPressOut = () =>
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

    return (
      <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Animated.View style={[...baseStyle, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return <View style={baseStyle}>{children}</View>;
}

Card.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'outlined', 'raised']),
  padding: PropTypes.number,
  onPress: PropTypes.func,
  style: PropTypes.object,
};

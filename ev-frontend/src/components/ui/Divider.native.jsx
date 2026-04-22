import React from 'react';
import PropTypes from 'prop-types';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';

/**
 * Divider — Native
 * Props: label, orientation ('horizontal' | 'vertical'), style
 */
export default function Divider({ label, orientation = 'horizontal', style }) {
  const { tokens } = useTheme();
  const { colors, typography } = tokens;

  if (orientation === 'vertical') {
    return (
      <View
        style={[{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }, style]}
      />
    );
  }

  if (label) {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text
          style={{
            marginHorizontal: 12,
            fontSize: typography.size.xs,
            color: colors.textMuted,
            fontWeight: String(typography.weight.medium),
          }}
        >
          {label}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
    );
  }

  return (
    <View style={[{ height: 1, backgroundColor: colors.border }, style]} />
  );
}

Divider.propTypes = {
  label: PropTypes.string,
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  style: PropTypes.object,
};

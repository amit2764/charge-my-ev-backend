import React from 'react';
import PropTypes from 'prop-types';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export default function Toggle({ checked = false, onChange, disabled = false, label, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
      <Pressable
        disabled={disabled}
        onPress={() => onChange?.(!checked)}
        style={{
          width: 44,
          height: 26,
          borderRadius: radius.full,
          backgroundColor: checked ? colors.brandPrimary : colors.borderStrong,
          padding: 3,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.full,
            backgroundColor: colors.surface,
            transform: [{ translateX: checked ? 18 : 0 }],
          }}
        />
      </Pressable>
      {label ? <Text style={{ color: colors.text, fontSize: typography.size.md }}>{label}</Text> : null}
    </View>
  );
}

Toggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  label: PropTypes.node,
  style: PropTypes.object,
};

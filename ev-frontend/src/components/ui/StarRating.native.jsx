import React from 'react';
import PropTypes from 'prop-types';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export default function StarRating({ value = 0, outOf = 5, onChange, size = 22, readOnly = false, style }) {
  const { tokens } = useTheme();
  const { colors } = tokens;

  return (
    <View style={[{ flexDirection: 'row', gap: 6, alignItems: 'center' }, style]}>
      {Array.from({ length: outOf }).map((_, i) => {
        const active = i < value;
        return (
          <Pressable key={i} disabled={readOnly} onPress={() => onChange?.(i + 1)}>
            <Text style={{ color: active ? colors.warning : colors.textSoft, fontSize: size }}>★</Text>
          </Pressable>
        );
      })}
    </View>
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

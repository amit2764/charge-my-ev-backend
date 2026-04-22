import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { TextInput, View } from 'react-native';
import { useTheme } from '../../theme';

export default function PinInput({ length = 4, value = '', onChange, onComplete, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;
  const refs = useRef([]);

  const digits = String(value || '').slice(0, length).split('');
  while (digits.length < length) digits.push('');

  return (
    <View style={[{ flexDirection: 'row', gap: 10 }, style]}>
      {digits.map((digit, idx) => (
        <TextInput
          key={idx}
          ref={(node) => {
            refs.current[idx] = node;
          }}
          value={digit}
          keyboardType="number-pad"
          maxLength={1}
          onChangeText={(txt) => {
            const d = String(txt || '').replace(/\D/g, '').slice(-1);
            const next = [...digits];
            next[idx] = d;
            const merged = next.join('');
            onChange?.(merged);
            if (d && idx < length - 1) refs.current[idx + 1]?.focus();
            if (merged.length >= length) onComplete?.(merged.slice(0, length));
          }}
          style={{
            width: 48,
            height: 52,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            color: colors.text,
            textAlign: 'center',
            fontSize: typography.size.xl,
          }}
        />
      ))}
    </View>
  );
}

PinInput.propTypes = {
  length: PropTypes.number,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  style: PropTypes.object,
};

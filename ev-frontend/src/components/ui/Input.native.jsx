import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Text, TextInput, View } from 'react-native';
import { useTheme } from '../../theme';

export function Input({ label, hint, error, disabled = false, style, inputStyle, ...rest }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={{ fontSize: typography.size.sm, color: colors.textMuted }}>{label}</Text> : null}
      <View
        style={{
          borderWidth: 1,
          borderColor: error ? colors.error : focused ? colors.brandPrimary : colors.border,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          minHeight: 46,
          justifyContent: 'center',
          paddingHorizontal: 12,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <TextInput
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={colors.textSoft}
          style={{ color: colors.text, fontSize: typography.size.md, fontFamily: typography.family.sans, ...inputStyle }}
          {...rest}
        />
      </View>
      {hint || error ? <Text style={{ fontSize: typography.size.sm, color: error ? colors.error : colors.textSoft }}>{error || hint}</Text> : null}
    </View>
  );
}

export function PhoneInput({ value = '', onChange, ...props }) {
  return (
    <Input
      value={String(value || '').replace(/\D/g, '').slice(0, 10)}
      onChangeText={(txt) => onChange?.(String(txt || '').replace(/\D/g, '').slice(0, 10))}
      keyboardType="number-pad"
      {...props}
    />
  );
}

export function OtpInput({ length = 6, value = '', onChange, onComplete, error = false, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;
  const refs = useRef([]);

  const digits = String(value || '').slice(0, length).split('');
  while (digits.length < length) digits.push('');

  return (
    <View style={[{ flexDirection: 'row', gap: 8 }, style]}>
      {digits.map((digit, idx) => (
        <TextInput
          key={idx}
          ref={(node) => {
            refs.current[idx] = node;
          }}
          value={digit}
          onChangeText={(txt) => {
            const d = String(txt || '').replace(/\D/g, '').slice(-1);
            const next = [...digits];
            next[idx] = d;
            const merged = next.join('');
            onChange?.(merged);
            if (d && idx < length - 1) refs.current[idx + 1]?.focus();
            if (merged.length >= length) onComplete?.(merged.slice(0, length));
          }}
          keyboardType="number-pad"
          maxLength={1}
          style={{
            width: 44,
            height: 50,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: error ? colors.error : colors.borderStrong,
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

Input.propTypes = {
  label: PropTypes.node,
  hint: PropTypes.node,
  error: PropTypes.node,
  disabled: PropTypes.bool,
  style: PropTypes.object,
  inputStyle: PropTypes.object,
};

PhoneInput.propTypes = { value: PropTypes.string, onChange: PropTypes.func };

OtpInput.propTypes = {
  length: PropTypes.number,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onComplete: PropTypes.func,
  error: PropTypes.bool,
  style: PropTypes.object,
};

export default Input;

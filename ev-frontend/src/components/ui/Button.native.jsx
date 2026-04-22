import React from 'react';
import PropTypes from 'prop-types';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export default function Button({ children, variant = 'primary', size = 'md', loading = false, disabled = false, style, textStyle, ...rest }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  const variants = {
    primary: { bg: colors.brandPrimary, fg: colors.onBrand, border: colors.brandPrimary },
    secondary: { bg: colors.surfaceRaised, fg: colors.text, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.text, border: 'transparent' },
    danger: { bg: colors.error, fg: colors.onBrand, border: colors.error },
  };
  const sizes = {
    sm: { py: 8, px: 12, fs: typography.size.sm },
    md: { py: 10, px: 14, fs: typography.size.md },
    lg: { py: 12, px: 16, fs: typography.size.lg },
  };

  const tone = variants[variant] || variants.primary;
  const sz = sizes[size] || sizes.md;
  const off = disabled || loading;

  return (
    <Pressable
      disabled={off}
      style={({ pressed }) => ({
        backgroundColor: tone.bg,
        borderColor: tone.border,
        borderWidth: 1,
        borderRadius: radius.sm,
        paddingVertical: sz.py,
        paddingHorizontal: sz.px,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.6 : pressed ? 0.85 : 1,
        flexDirection: 'row',
        gap: 8,
        ...style,
      })}
      {...rest}
    >
      {loading && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tone.fg }} />}
      <Text style={{ color: tone.fg, fontSize: sz.fs, fontFamily: typography.family.sans, fontWeight: typography.weight.semibold, ...textStyle }}>
        {children}
      </Text>
    </Pressable>
  );
}

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.string,
  size: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  style: PropTypes.object,
  textStyle: PropTypes.object,
};

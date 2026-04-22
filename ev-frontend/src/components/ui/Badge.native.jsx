import React from 'react';
import PropTypes from 'prop-types';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';

export default function Badge({ children, tone = 'default', style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  const tones = {
    default: { bg: colors.surfaceRaised, fg: colors.text, border: colors.border },
    success: { bg: colors.successBg, fg: colors.success, border: colors.success },
    warning: { bg: colors.warningBg, fg: colors.warning, border: colors.warning },
    danger: { bg: colors.errorBg, fg: colors.error, border: colors.error },
    info: { bg: colors.infoBg, fg: colors.info, border: colors.info },
  };
  const t = tones[tone] || tones.default;

  return (
    <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: radius.full, backgroundColor: t.bg, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', ...style }}>
      <Text style={{ color: t.fg, fontSize: typography.size.xs, fontWeight: typography.weight.semibold }}>{children}</Text>
    </View>
  );
}

Badge.propTypes = { children: PropTypes.node, tone: PropTypes.string, style: PropTypes.object };

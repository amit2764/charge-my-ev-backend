import React from 'react';
import PropTypes from 'prop-types';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';

export default function Toast({ message, type = 'info', style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  const tones = {
    info: { bg: colors.infoBg, fg: colors.info },
    success: { bg: colors.successBg, fg: colors.success },
    warning: { bg: colors.warningBg, fg: colors.warning },
    error: { bg: colors.errorBg, fg: colors.error },
  };
  const tone = tones[type] || tones.info;

  return (
    <View style={[{ borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: tone.bg, padding: 10 }, style]}>
      <Text style={{ color: tone.fg, fontSize: typography.size.sm }}>{message}</Text>
    </View>
  );
}

Toast.propTypes = {
  message: PropTypes.node,
  type: PropTypes.string,
  style: PropTypes.object,
};

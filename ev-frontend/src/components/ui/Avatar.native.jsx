import React from 'react';
import PropTypes from 'prop-types';
import { Image, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export default function Avatar({ src, name = '', size = 40, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  const initials = String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

  return (
    <View style={[{ width: size, height: size, borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }, style]}>
      {src ? <Image source={{ uri: src }} style={{ width: size, height: size }} /> : <Text style={{ color: colors.text, fontSize: typography.size.md }}>{initials}</Text>}
    </View>
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.number,
  style: PropTypes.object,
};

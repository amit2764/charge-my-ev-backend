import React from 'react';
import PropTypes from 'prop-types';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import Button from './Button.native';

export default function EmptyState({ icon = '∅', title, description, actionLabel, onAction, style }) {
  const { tokens } = useTheme();
  const { colors, typography, radius } = tokens;

  return (
    <View style={[{ borderWidth: 1, borderColor: colors.borderStrong, borderStyle: 'dashed', borderRadius: radius.md, backgroundColor: colors.surface, padding: 20, alignItems: 'center', gap: 8 }, style]}>
      <Text style={{ color: colors.textSoft, fontSize: 28 }}>{icon}</Text>
      <Text style={{ color: colors.text, fontSize: typography.size.xl, fontWeight: typography.weight.bold }}>{title}</Text>
      {description ? <Text style={{ color: colors.textMuted, fontSize: typography.size.md, textAlign: 'center' }}>{description}</Text> : null}
      {actionLabel ? (
        <Button size="sm" variant="secondary" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node,
  description: PropTypes.node,
  actionLabel: PropTypes.node,
  onAction: PropTypes.func,
  style: PropTypes.object,
};

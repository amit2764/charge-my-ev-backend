import React from 'react';
import PropTypes from 'prop-types';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';

function formatValue(value, format) {
  if (typeof format === 'function') return format(value);
  if (format === 'currency') return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
  return Number(value || 0).toLocaleString('en-IN');
}

export default function StatCard({ title, value, delta, icon, format, style }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  return (
    <View style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, padding: 12, gap: 4 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textMuted, fontSize: typography.size.sm }}>{title}</Text>
        {icon ? <Text style={{ color: colors.textSoft }}>{icon}</Text> : null}
      </View>
      <Text style={{ color: colors.text, fontSize: typography.size['2xl'], fontWeight: typography.weight.bold }}>{formatValue(value, format)}</Text>
      {typeof delta === 'number' ? (
        <Text style={{ color: delta > 0 ? colors.success : delta < 0 ? colors.error : colors.textSoft, fontSize: typography.size.sm }}>
          {delta > 0 ? '↑' : delta < 0 ? '↓' : '•'} {Math.abs(delta)}%
        </Text>
      ) : null}
    </View>
  );
}

StatCard.propTypes = {
  title: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  delta: PropTypes.number,
  icon: PropTypes.node,
  format: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  style: PropTypes.object,
};

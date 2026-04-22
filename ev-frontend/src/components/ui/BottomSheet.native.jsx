import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';

export default function BottomSheet({ open = false, onClose, title, children }) {
  const { tokens } = useTheme();
  const { colors, radius, typography } = tokens;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay }} />
      <View style={{ backgroundColor: colors.surfaceRaised, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 14, maxHeight: '75%' }}>
        <View style={{ width: 36, height: 4, borderRadius: radius.full, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: 10 }} />
        {title ? <Text style={{ color: colors.text, fontSize: typography.size.lg, fontWeight: typography.weight.bold, marginBottom: 8 }}>{title}</Text> : null}
        <View>{children}</View>
      </View>
    </Modal>
  );
}

BottomSheet.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.node,
  children: PropTypes.node,
};

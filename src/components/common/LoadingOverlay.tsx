import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZE, SPACING } from '../../constants';

interface LoadingOverlayProps {
  message?: string;
  visible: boolean;
}

export default function LoadingOverlay({ message, visible }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        {message && <Text style={styles.message}>{message}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    minWidth: 160,
  },
  message: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
  },
});

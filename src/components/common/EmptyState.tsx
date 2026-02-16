import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE } from '../../constants';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}

export default function EmptyState({
  icon = 'document-text-outline',
  title,
  message,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={COLORS.border} />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  message: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS } from '../../constants';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
  noPadding?: boolean;
}

export default function Card({ children, title, style, noPadding }: CardProps) {
  return (
    <View style={[styles.card, !noPadding && styles.padding, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.small,
  },
  padding: {
    padding: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { format, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

interface MonthSelectorProps {
  currentMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
}

export default function MonthSelector({ currentMonth, onMonthChange }: MonthSelectorProps) {
  const date = new Date(currentMonth + '-01');

  const displayText = format(date, 'yyyy年 M月', { locale: ja });

  const handlePrev = () => {
    const prev = subMonths(date, 1);
    onMonthChange(format(prev, 'yyyy-MM'));
  };

  const handleNext = () => {
    const next = addMonths(date, 1);
    onMonthChange(format(next, 'yyyy-MM'));
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePrev} style={styles.arrow}>
        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
      </TouchableOpacity>

      <Text style={styles.monthText}>{displayText}</Text>

      <TouchableOpacity onPress={handleNext} style={styles.arrow}>
        <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.lg,
  },
  arrow: {
    padding: SPACING.sm,
  },
  monthText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 140,
    textAlign: 'center',
  },
});

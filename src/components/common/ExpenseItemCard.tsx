import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants';
import { CATEGORY_MAP } from '../../constants';
import { Expense } from '../../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ExpenseItemCardProps {
  expense: Expense;
  onPress?: () => void;
}

export default function ExpenseItemCard({ expense, onPress }: ExpenseItemCardProps) {
  const categoryInfo = CATEGORY_MAP[expense.category];
  const categoryLabels = Array.from(
    new Set(
      expense.items.map((item) => CATEGORY_MAP[item.category ?? expense.category]?.label || 'その他')
    )
  );
  const categoryText = categoryLabels.join('・');

  const formattedDate = (() => {
    try {
      return format(new Date(expense.date), 'M/d (E)', { locale: ja });
    } catch {
      return expense.date;
    }
  })();

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: categoryInfo?.color + '20' }]}>
        <Ionicons
          name={(categoryInfo?.icon as any) || 'ellipsis-horizontal'}
          size={22}
          color={categoryInfo?.color || COLORS.textSecondary}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.storeName} numberOfLines={1}>
          {expense.storeName || '不明な店舗'}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.category} numberOfLines={1}>
            {categoryText}
          </Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
      </View>

      <Text style={styles.amount}>
        ¥{expense.amount.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
  },
  storeName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  category: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  date: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  amount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
});

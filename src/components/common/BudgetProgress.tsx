import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, CATEGORY_MAP, CATEGORIES } from '../../constants';
import { MonthlyBudget, MonthlySummary, ExpenseCategory } from '../../types';

interface BudgetProgressProps {
  budget: MonthlyBudget;
  summary: MonthlySummary | null;
  /** trueならカテゴリ別の内訳バーも表示 */
  showCategoryBreakdown?: boolean;
  /** 特定カテゴリの予算のみ表示 */
  filterCategory?: ExpenseCategory | null;
}

export default function BudgetProgress({
  budget,
  summary,
  showCategoryBreakdown = false,
  filterCategory = null,
}: BudgetProgressProps) {
  if (!budget || budget.totalBudget <= 0) return null;

  // カテゴリフィルターが指定されている場合、そのカテゴリの予算だけ表示
  if (filterCategory) {
    const catBudget = budget.categoryBudgets.find((cb) => cb.category === filterCategory);
    if (!catBudget || catBudget.amount <= 0) return null;

    const info = CATEGORY_MAP[filterCategory];
    const catSpent =
      summary?.categoryBreakdown.find((b) => b.category === filterCategory)?.amount || 0;
    const catRatio = catBudget.amount > 0 ? Math.min(catSpent / catBudget.amount, 1) : 0;
    const catPct = Math.round(catRatio * 100);
    const catOver = catSpent > catBudget.amount;
    const catRemaining = catBudget.amount - catSpent;
    const catBarColor = catOver
      ? COLORS.error
      : catPct >= 80
      ? COLORS.warning
      : info?.color || COLORS.success;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[styles.categoryDot, { backgroundColor: info?.color }]} />
            <Text style={styles.title}>{info?.label} の予算</Text>
          </View>
          <Text style={[styles.percentage, { color: catBarColor }]}>{catPct}%</Text>
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${Math.min(catPct, 100)}%`, backgroundColor: catBarColor }]} />
        </View>
        <View style={styles.amounts}>
          <Text style={styles.spentText}>
            ¥{catSpent.toLocaleString()}
            <Text style={styles.ofText}> / ¥{catBudget.amount.toLocaleString()}</Text>
          </Text>
          <Text style={[styles.remainingText, catOver && styles.overText]}>
            {catOver ? `¥${Math.abs(catRemaining).toLocaleString()} オーバー` : `残り ¥${catRemaining.toLocaleString()}`}
          </Text>
        </View>
      </View>
    );
  }

  const spent = summary?.totalAmount || 0;
  const remaining = budget.totalBudget - spent;
  const ratio = Math.min(spent / budget.totalBudget, 1);
  const percentage = Math.round(ratio * 100);
  const isOver = spent > budget.totalBudget;

  const barColor = isOver
    ? COLORS.error
    : percentage >= 80
    ? COLORS.warning
    : COLORS.success;

  return (
    <View style={styles.container}>
      {/* 全体の予算バー */}
      <View style={styles.header}>
        <Text style={styles.title}>💰 予算</Text>
        <Text style={[styles.percentage, { color: barColor }]}>{percentage}%</Text>
      </View>

      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.min(percentage, 100)}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.amounts}>
        <Text style={styles.spentText}>
          ¥{spent.toLocaleString()}
          <Text style={styles.ofText}> / ¥{budget.totalBudget.toLocaleString()}</Text>
        </Text>
        <Text style={[styles.remainingText, isOver && styles.overText]}>
          {isOver ? `¥${Math.abs(remaining).toLocaleString()} オーバー` : `残り ¥${remaining.toLocaleString()}`}
        </Text>
      </View>

      {/* カテゴリ別内訳 */}
      {showCategoryBreakdown && (
        <View style={styles.categorySection}>
          <Text style={styles.categorySectionTitle}>📊 カテゴリ別予算</Text>
          {budget.categoryBudgets.filter((cb) => cb.amount > 0).length === 0 ? (
            <Text style={styles.noCategoryBudgetText}>
              カテゴリー別の予算が設定されていません
            </Text>
          ) : (
            budget.categoryBudgets
              .filter((cb) => cb.amount > 0)
              .map((cb) => {
                const info = CATEGORY_MAP[cb.category];
                const catSpent =
                  summary?.categoryBreakdown.find((b) => b.category === cb.category)?.amount || 0;
                const catRatio = Math.min(catSpent / cb.amount, 1);
                const catPct = Math.round(catRatio * 100);
                const catOver = catSpent > cb.amount;
                const catBarColor = catOver
                  ? COLORS.error
                  : catPct >= 80
                  ? COLORS.warning
                  : info?.color || COLORS.success;

                return (
                  <View key={cb.category} style={styles.categoryRow}>
                    <View style={styles.categoryHeader}>
                      <View style={[styles.categoryDot, { backgroundColor: info?.color }]} />
                      <Text style={styles.categoryLabel}>{info?.label}</Text>
                      <Text style={[styles.categoryPct, { color: catBarColor }]}>{catPct}%</Text>
                      <Text style={styles.categoryAmount}>
                        ¥{catSpent.toLocaleString()} / ¥{cb.amount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.categoryBar}>
                      <View
                        style={[
                          styles.categoryBarFill,
                          { width: `${Math.min(catPct, 100)}%`, backgroundColor: catBarColor },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  percentage: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '900',
  },
  bar: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  amounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spentText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  ofText: {
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  remainingText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.success,
  },
  overText: {
    color: COLORS.error,
  },
  categorySection: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.sm,
  },
  categorySectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  noCategoryBudgetText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },
  categoryRow: {
    marginBottom: SPACING.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  categoryPct: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  categoryAmount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  categoryBar: {
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});

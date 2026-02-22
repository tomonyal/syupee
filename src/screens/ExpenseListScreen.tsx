import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ExpenseItemCard, CategoryFilter, MonthSelector, EmptyState, BudgetProgress } from '../components';
import { useExpenseStore, useBudgetStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, CATEGORY_MAP } from '../constants';

export default function ExpenseListScreen() {
  const {
    filteredExpenses,
    selectedMonth,
    selectedCategory,
    currentMonthSummary,
    isLoading,
    setSelectedMonth,
    setSelectedCategory,
    loadFilteredExpenses,
    loadMonthlySummary,
  } = useExpenseStore();
  const { budget, loadBudget } = useBudgetStore();
  const navigation = useNavigation<any>();

  useFocusEffect(
    useCallback(() => {
      loadFilteredExpenses();
      loadMonthlySummary();
      loadBudget();
    }, [])
  );

  return (
    <View style={styles.screen}>
      {/* ヘッダー部分: FlatListの外に配置して再マウントを防ぐ */}
      <MonthSelector currentMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      <FlatList
        style={{ flex: 1 }}
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {/* 月間合計 */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {selectedCategory
                  ? `${CATEGORY_MAP[selectedCategory]?.label || ''} 合計`
                  : '月間合計'}
              </Text>
              <Text style={styles.totalAmount}>
                ¥{(currentMonthSummary?.totalAmount || 0).toLocaleString()}
              </Text>
            </View>

            {/* 予算インジケーター */}
            {budget && budget.totalBudget > 0 ? (
              <View style={styles.budgetWrapper}>
                <BudgetProgress
                  budget={budget}
                  summary={currentMonthSummary}
                  filterCategory={selectedCategory}
                  showCategoryBreakdown={!selectedCategory}
                />
              </View>
            ) : !selectedCategory && (
              <View style={styles.noBudgetCard}>
                <Text style={styles.noBudgetIcon}>💡</Text>
                <Text style={styles.noBudgetTitle}>予算を設定していませんでした。</Text>
                <Text style={styles.noBudgetDescription}>
                  予算を設定すると各カテゴリーごとの予算と支出を確認できます。
                </Text>
              </View>
            )}

            {/* カテゴリフィルタ */}
            <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <ExpenseItemCard
              expense={item}
              onPress={() =>
                navigation.navigate('ExpenseDetail', { expenseId: item.id })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              color={COLORS.primary}
              size="large"
              style={styles.loader}
            />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="支出がありません"
              message="レシートを撮影して支出を記録しましょう"
            />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  itemWrapper: {
    paddingHorizontal: SPACING.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  totalLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '900',
    color: COLORS.primary,
  },
  budgetWrapper: {
    paddingHorizontal: SPACING.md,
  },
  noBudgetCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  noBudgetIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  noBudgetTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  noBudgetDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loader: {
    marginTop: SPACING.xxl,
  },
});

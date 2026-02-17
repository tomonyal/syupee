import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { Card, ExpenseItemCard, EmptyState, MonthSelector, BudgetProgress } from '../components';
import { useExpenseStore, useAuthStore, useBudgetStore, useCoinStore, useUsageStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORY_MAP, COIN_PER_SCAN, getNextRankInfo } from '../constants';
import { PLAN_MAP } from '../constants';
import { getDailyAdvice } from '../services/openai';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const {
    recentExpenses,
    currentMonthSummary,
    selectedMonth,
    setSelectedMonth,
    loadRecentExpenses,
    loadMonthlySummary,
  } = useExpenseStore();

  const { user } = useAuthStore();
  const { budget, loadBudget } = useBudgetStore();
  const { balance, monthlyScans, rank, loadCoinData } = useCoinStore();
  const { ocrUsedThisMonth, chatUsedThisMonth, loadUsage } = useUsageStore();
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = React.useState(false);
  const [dailyAdvice, setDailyAdvice] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  const loadAdvice = useCallback(async () => {
    setAdviceLoading(true);
    try {
      const advice = await getDailyAdvice();
      setDailyAdvice(advice);
    } catch {
      setDailyAdvice(null);
    } finally {
      setAdviceLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecentExpenses();
      loadMonthlySummary();
      loadBudget();
      loadAdvice();
      loadCoinData();
      loadUsage();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRecentExpenses(), loadMonthlySummary(), loadAdvice(), loadUsage()]);
    setRefreshing(false);
  };

  const planInfo = user ? PLAN_MAP[user.plan] : null;

  // グラフデータ
  const chartData =
    currentMonthSummary?.categoryBreakdown.map((cat) => {
      const info = CATEGORY_MAP[cat.category];
      return {
        name: info?.label || cat.category,
        amount: cat.amount,
        color: info?.color || '#868E96',
        legendFontColor: COLORS.textSecondary,
        legendFontSize: 11,
      };
    }) || [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
      }
    >
      {/* 月選択 */}
      <MonthSelector currentMonth={selectedMonth} onMonthChange={setSelectedMonth} />

      {/* 月間サマリーカード（一番上） */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Main', { screen: 'Expenses' })}
      >
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>今月の支出合計</Text>
          <Text style={styles.summaryAmount}>
            ¥{(currentMonthSummary?.totalAmount || 0).toLocaleString()}
          </Text>
          <Text style={styles.summaryCount}>
            {currentMonthSummary?.expenseCount || 0}件の支出
          </Text>
        </Card>
      </TouchableOpacity>

      {/* コイン＆ランク */}
      <View style={styles.coinRankRow}>
        <TouchableOpacity
          style={styles.coinCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('CoinShop')}
        >
          <Text style={styles.coinCardIcon}>🪙</Text>
          <Text style={styles.coinCardBalance}>{balance}</Text>
          <Text style={styles.coinCardLabel}>コイン</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rankCard, { borderColor: rank.color }]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('RankDetail')}
        >
          <Text style={styles.rankCardIcon}>{rank.icon}</Text>
          <Text style={[styles.rankCardLabel, { color: rank.color }]}>{rank.label}</Text>
          <Text style={styles.rankCardScans}>今月 {monthlyScans}回</Text>
        </TouchableOpacity>
      </View>

      {/* 今日のアドバイス */}
      {(adviceLoading || dailyAdvice) && (
        <Card style={styles.adviceCard}>
          <View style={styles.adviceHeader}>
            <Text style={styles.adviceAvatar}>🐣</Text>
            <Text style={styles.adviceTitle}>今日のアドバイス</Text>
          </View>
          {adviceLoading ? (
            <View style={styles.adviceLoading}>
              <ActivityIndicator size="small" color={COLORS.secondary} />
              <Text style={styles.adviceLoadingText}>シュッピくんが考え中...</Text>
            </View>
          ) : (
            <Text style={styles.adviceText}>{dailyAdvice}</Text>
          )}
        </Card>
      )}

      {/* 予算インジケーター */}
      {budget && budget.totalBudget > 0 && (
        <BudgetProgress
          budget={budget}
          summary={currentMonthSummary}
          showCategoryBreakdown
        />
      )}

      {/* 利用状況 */}
      {planInfo && user && (
        <Card title="📊 利用状況" style={styles.usageCard}>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>OCR撮影</Text>
            <Text style={styles.usageValue}>
              {ocrUsedThisMonth} / {planInfo.ocrLimit}回
            </Text>
            <View style={styles.usageBar}>
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${Math.min((ocrUsedThisMonth / planInfo.ocrLimit) * 100, 100)}%`,
                    backgroundColor: COLORS.primary,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>AI相談</Text>
            <Text style={styles.usageValue}>
              {chatUsedThisMonth} / {planInfo.chatLimit}回
            </Text>
            <View style={styles.usageBar}>
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${Math.min((chatUsedThisMonth / planInfo.chatLimit) * 100, 100)}%`,
                    backgroundColor: COLORS.secondary,
                  },
                ]}
              />
            </View>
          </View>
        </Card>
      )}

      {/* カテゴリ別円グラフ */}
      {chartData.length > 0 && (
        <Card title="📈 カテゴリ別支出" style={styles.chartCard}>
          <PieChart
            data={chartData}
            width={screenWidth - SPACING.xl * 2 - SPACING.md * 2}
            height={200}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="0"
            absolute
          />
        </Card>
      )}

      {/* 最近の支出 */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>🕐 最近の支出</Text>
        {recentExpenses.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="まだ支出がありません"
            message="レシートを撮影して支出を記録しましょう！"
          />
        ) : (
          recentExpenses.slice(0, 5).map((expense) => (
            <ExpenseItemCard
              key={expense.id}
              expense={expense}
              onPress={() =>
                navigation.navigate('ExpenseDetail', { expenseId: expense.id })
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primary,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.textOnPrimary,
    marginVertical: SPACING.xs,
  },
  summaryCount: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  coinRankRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  coinCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  coinCardIcon: {
    fontSize: 28,
  },
  coinCardBalance: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '900',
    color: COLORS.text,
  },
  coinCardLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  rankCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  rankCardIcon: {
    fontSize: 28,
  },
  rankCardLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '800',
  },
  rankCardScans: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  adviceCard: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  adviceAvatar: {
    fontSize: 24,
  },
  adviceTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  adviceText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  adviceLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  adviceLoadingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  usageCard: {
    marginBottom: SPACING.md,
  },
  usageRow: {
    marginBottom: SPACING.sm,
  },
  usageLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  usageValue: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  usageBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  chartCard: {
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  recentSection: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
});

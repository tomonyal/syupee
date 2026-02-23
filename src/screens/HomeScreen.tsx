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
import { getSeasonDisplayName } from '../utils';

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
  const { balance, ocrQuotaBalance, chatQuotaBalance, monthlyScans, seasonScans, rank, percentile, totalUsers, currentSeason, loadCoinData } = useCoinStore();
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

        <View style={[styles.rankCard, { borderColor: COLORS.border }]}>
          <Text style={styles.rankCardIcon}>🏅</Text>
          <Text style={[styles.rankCardLabel, { color: COLORS.textSecondary }]}>ランク</Text>
          <Text style={[styles.rankCardScans, { color: COLORS.textSecondary, marginTop: 8 }]}>
            開発中...
          </Text>
        </View>
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
              <Text style={styles.adviceLoadingText}>シュッピーが考え中...</Text>
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
        <Card style={styles.usageCard}>
          <View style={styles.usageCardHeader}>
            <Text style={styles.usageCardTitle}>📊 利用状況</Text>
            <TouchableOpacity
              style={styles.quotaPurchaseButton}
              onPress={() => navigation.navigate('QuotaPurchase')}
            >
              <Ionicons name="add-circle" size={20} color={COLORS.text} />
              <Text style={styles.quotaPurchaseButtonText}>追加購入</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>OCR撮影</Text>
            <Text style={styles.usageValue}>
              {ocrUsedThisMonth} / {planInfo.ocrLimit + ocrQuotaBalance}回
            </Text>
            <View style={styles.usageBar}>
              {/* プラン枠内の使用済み（青） */}
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${(Math.min(ocrUsedThisMonth, planInfo.ocrLimit) / (planInfo.ocrLimit + ocrQuotaBalance)) * 100}%`,
                    backgroundColor: '#2196F3',
                  },
                ]}
              />
              {/* プラン枠内の未使用（グレー） */}
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${((planInfo.ocrLimit - Math.min(ocrUsedThisMonth, planInfo.ocrLimit)) / (planInfo.ocrLimit + ocrQuotaBalance)) * 100}%`,
                    backgroundColor: '#E0E0E0',
                  },
                ]}
              />
              {/* 追加購入分の使用済み（オレンジ） */}
              {ocrUsedThisMonth > planInfo.ocrLimit && (
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${((Math.min(ocrUsedThisMonth - planInfo.ocrLimit, ocrQuotaBalance) / (planInfo.ocrLimit + ocrQuotaBalance)) * 100)}%`,
                      backgroundColor: '#FF9800',
                    },
                  ]}
                />
              )}
              {/* 追加購入分の未使用（薄いオレンジ） */}
              {ocrQuotaBalance > 0 && (
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${((ocrQuotaBalance - Math.max(0, ocrUsedThisMonth - planInfo.ocrLimit)) / (planInfo.ocrLimit + ocrQuotaBalance)) * 100}%`,
                      backgroundColor: '#FFE0B2',
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.usageLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.legendText}>プラン枠使用（{Math.min(ocrUsedThisMonth, planInfo.ocrLimit)}/{planInfo.ocrLimit}）</Text>
              </View>
              {ocrQuotaBalance > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
                  <Text style={styles.legendText}>追加購入使用（{Math.max(0, ocrUsedThisMonth - planInfo.ocrLimit)}/{ocrQuotaBalance}）</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.usageRow}>
            <Text style={styles.usageLabel}>AI相談</Text>
            <Text style={styles.usageValue}>
              {chatUsedThisMonth} / {planInfo.chatLimit + chatQuotaBalance}回
            </Text>
            <View style={styles.usageBar}>
              {/* プラン枠内の使用済み（緑） */}
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${(Math.min(chatUsedThisMonth, planInfo.chatLimit) / (planInfo.chatLimit + chatQuotaBalance)) * 100}%`,
                    backgroundColor: '#4CAF50',
                  },
                ]}
              />
              {/* プラン枠内の未使用（グレー） */}
              <View
                style={[
                  styles.usageBarFill,
                  {
                    width: `${((planInfo.chatLimit - Math.min(chatUsedThisMonth, planInfo.chatLimit)) / (planInfo.chatLimit + chatQuotaBalance)) * 100}%`,
                    backgroundColor: '#E0E0E0',
                  },
                ]}
              />
              {/* 追加購入分の使用済み（濃い緑） */}
              {chatUsedThisMonth > planInfo.chatLimit && (
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${((Math.min(chatUsedThisMonth - planInfo.chatLimit, chatQuotaBalance) / (planInfo.chatLimit + chatQuotaBalance)) * 100)}%`,
                      backgroundColor: '#2E7D32',
                    },
                  ]}
                />
              )}
              {/* 追加購入分の未使用（薄い緑） */}
              {chatQuotaBalance > 0 && (
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      width: `${((chatQuotaBalance - Math.max(0, chatUsedThisMonth - planInfo.chatLimit)) / (planInfo.chatLimit + chatQuotaBalance)) * 100}%`,
                      backgroundColor: '#C8E6C9',
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.usageLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>プラン枠使用（{Math.min(chatUsedThisMonth, planInfo.chatLimit)}/{planInfo.chatLimit}）</Text>
              </View>
              {chatQuotaBalance > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#2E7D32' }]} />
                  <Text style={styles.legendText}>追加購入使用（{Math.max(0, chatUsedThisMonth - planInfo.chatLimit)}/{chatQuotaBalance}）</Text>
                </View>
              )}
            </View>
          </View>
        </Card>
      )}

      {/* カテゴリ別円グラフ */}
      {chartData.length > 0 && (
        <Card title="📈 カテゴリ別支出" style={styles.chartCard}>
          <PieChart
            data={chartData}
            width={screenWidth - SPACING.xl * 4}
            height={160}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="20"
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
    backgroundColor: COLORS.surface,
  },
  summaryLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#F57C00',
    marginVertical: SPACING.xs,
  },
  summaryCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
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
  rankCardReward: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.accent,
    fontWeight: '700',
    marginTop: 4,
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
  usageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  usageCardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  quotaPurchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primaryLight,
    borderRadius: BORDER_RADIUS.md,
  },
  quotaPurchaseButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    fontWeight: '600',
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
  quotaNote: {
    fontSize: FONT_SIZE.xs,
    color: '#9C27B0',
    fontWeight: '600',
    marginTop: 2,
  },
  usageBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  usageBarFill: {
    height: '100%',
  },
  usageLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
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

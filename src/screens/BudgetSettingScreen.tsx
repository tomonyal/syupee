import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MonthSelector, Card } from '../components';
import { useBudgetStore } from '../store';
import { CATEGORIES, COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, CATEGORY_MAP } from '../constants';
import { CategoryBudget, ExpenseCategory } from '../types';

type InputMode = 'total' | 'category';

export default function BudgetSettingScreen() {
  const navigation = useNavigation();
  const {
    budget,
    selectedMonth,
    isLoading,
    isAllocating,
    setSelectedMonth,
    loadBudget,
    saveAllBudgets,
    allocateWithAI,
  } = useBudgetStore();

  const [inputMode, setInputMode] = useState<InputMode>('total');
  const [totalBudgetInput, setTotalBudgetInput] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>(
    CATEGORIES.map((c) => ({ category: c.key as ExpenseCategory, amount: 0 }))
  );
  const [hasAllocated, setHasAllocated] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadBudget();
    }, [])
  );

  // 既存予算をフォームに反映
  useEffect(() => {
    if (budget) {
      setTotalBudgetInput(budget.totalBudget > 0 ? String(budget.totalBudget) : '');
      setCategoryBudgets(budget.categoryBudgets);
      setHasAllocated(true);
    } else {
      setTotalBudgetInput('');
      setCategoryBudgets(
        CATEGORIES.map((c) => ({ category: c.key as ExpenseCategory, amount: 0 }))
      );
      setHasAllocated(false);
    }
  }, [budget]);

  const totalBudgetNum = Number(totalBudgetInput) || 0;

  const categoryTotal = categoryBudgets.reduce((sum, cb) => sum + cb.amount, 0);

  const handleAllocateAI = async () => {
    if (totalBudgetNum <= 0) {
      Alert.alert('入力エラー', '合計生活費を入力してください');
      return;
    }
    try {
      const allocations = await allocateWithAI(totalBudgetNum);
      setCategoryBudgets(allocations);
      setHasAllocated(true);
      setInputMode('category');
    } catch (error: any) {
      Alert.alert('エラー', error.message || '予算の配分に失敗しました');
    }
  };

  const handleCategoryAmountChange = (category: ExpenseCategory, value: string) => {
    const amount = Number(value) || 0;
    setCategoryBudgets((prev) =>
      prev.map((cb) => (cb.category === category ? { ...cb, amount } : cb))
    );
  };

  const handleSave = async () => {
    const finalTotal = inputMode === 'total' ? totalBudgetNum : categoryTotal;
    const finalBudgets =
      inputMode === 'total' && !hasAllocated
        ? CATEGORIES.map((c) => ({ category: c.key as ExpenseCategory, amount: 0 }))
        : categoryBudgets;

    if (finalTotal <= 0) {
      Alert.alert('入力エラー', '予算を入力してください');
      return;
    }

    // 毎月の予算として設定するか確認
    Alert.alert(
      '毎月の予算として設定',
      'この予算を毎月の固定予算として設定しますか？\n「はい」にすると、今後の月にも自動で同じ予算が適用されます。',
      [
        {
          text: 'いいえ（今月のみ）',
          onPress: () => doSave(finalTotal, finalBudgets, false),
        },
        {
          text: 'はい',
          onPress: () => doSave(finalTotal, finalBudgets, true),
        },
      ]
    );
  };

  const doSave = async (
    total: number,
    budgets: CategoryBudget[],
    isRecurring: boolean
  ) => {
    try {
      await saveAllBudgets(total, budgets, isRecurring);
      const recurringText = isRecurring ? '（毎月適用）' : '';
      Alert.alert('保存完了', `${selectedMonth}の予算を保存しました${recurringText} ✨`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('エラー', '予算の保存に失敗しました');
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setHasAllocated(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 月選択 */}
        <MonthSelector
          currentMonth={selectedMonth}
          onMonthChange={handleMonthChange}
        />

        {/* モード切替 */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, inputMode === 'total' && styles.modeButtonActive]}
            onPress={() => setInputMode('total')}
          >
            <Ionicons
              name="wallet-outline"
              size={18}
              color={inputMode === 'total' ? COLORS.textOnPrimary : COLORS.text}
            />
            <Text
              style={[styles.modeButtonText, inputMode === 'total' && styles.modeButtonTextActive]}
            >
              まとめて設定
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, inputMode === 'category' && styles.modeButtonActive]}
            onPress={() => setInputMode('category')}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={inputMode === 'category' ? COLORS.textOnPrimary : COLORS.text}
            />
            <Text
              style={[
                styles.modeButtonText,
                inputMode === 'category' && styles.modeButtonTextActive,
              ]}
            >
              カテゴリ別設定
            </Text>
          </TouchableOpacity>
        </View>

        {inputMode === 'total' ? (
          /* === まとめて設定モード === */
          <View>
            <Card style={styles.totalCard}>
              <Text style={styles.sectionTitle}>💰 合計生活費</Text>
              <Text style={styles.sectionDescription}>
                まとめて生活費を入力すると、シュッピくんが{'\n'}過去の支出データをもとに最適な配分を提案します！
              </Text>
              <View style={styles.totalInputRow}>
                <Text style={styles.yen}>¥</Text>
                <TextInput
                  style={styles.totalInput}
                  value={totalBudgetInput}
                  onChangeText={setTotalBudgetInput}
                  keyboardType="numeric"
                  placeholder="例: 150000"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <TouchableOpacity
                style={[styles.aiButton, isAllocating && styles.aiButtonDisabled]}
                onPress={handleAllocateAI}
                disabled={isAllocating || totalBudgetNum <= 0}
              >
                {isAllocating ? (
                  <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
                ) : (
                  <>
                    <Text style={styles.aiButtonEmoji}>🐣</Text>
                    <Text style={styles.aiButtonText}>
                      シュッピくんに配分してもらう
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Card>

            {/* AI配分結果表示 */}
            {hasAllocated && (
              <Card style={styles.resultCard}>
                <Text style={styles.sectionTitle}>📊 カテゴリ別配分</Text>
                <Text style={styles.resultNote}>
                  金額をタップして手動で調整できます
                </Text>
                {categoryBudgets.map((cb) => {
                  const info = CATEGORY_MAP[cb.category];
                  const pct = totalBudgetNum > 0
                    ? ((cb.amount / totalBudgetNum) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <View key={cb.category} style={styles.categoryRow}>
                      <View style={styles.categoryLabelRow}>
                        <View style={[styles.categoryDot, { backgroundColor: info.color }]} />
                        <Text style={styles.categoryLabel}>{info.label}</Text>
                        <Text style={styles.categoryPct}>{pct}%</Text>
                      </View>
                      <View style={styles.categoryInputRow}>
                        <Text style={styles.yenSmall}>¥</Text>
                        <TextInput
                          style={styles.categoryInput}
                          value={cb.amount > 0 ? String(cb.amount) : ''}
                          onChangeText={(v) => handleCategoryAmountChange(cb.category, v)}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={COLORS.textLight}
                        />
                      </View>
                    </View>
                  );
                })}
                <View style={styles.totalSummary}>
                  <Text style={styles.totalSummaryLabel}>配分合計</Text>
                  <Text
                    style={[
                      styles.totalSummaryAmount,
                      categoryTotal !== totalBudgetNum && styles.totalSummaryMismatch,
                    ]}
                  >
                    ¥{categoryTotal.toLocaleString()}
                  </Text>
                </View>
                {categoryTotal !== totalBudgetNum && (
                  <Text style={styles.mismatchWarning}>
                    ⚠ 合計生活費 (¥{totalBudgetNum.toLocaleString()}) と一致していません
                  </Text>
                )}
              </Card>
            )}
          </View>
        ) : (
          /* === カテゴリ別設定モード === */
          <Card style={styles.resultCard}>
            <Text style={styles.sectionTitle}>📝 カテゴリ別予算</Text>
            <Text style={styles.resultNote}>
              各カテゴリの予算を個別に入力してください
            </Text>
            {categoryBudgets.map((cb) => {
              const info = CATEGORY_MAP[cb.category];
              return (
                <View key={cb.category} style={styles.categoryRow}>
                  <View style={styles.categoryLabelRow}>
                    <View style={[styles.categoryDot, { backgroundColor: info.color }]} />
                    <Text style={styles.categoryLabel}>{info.label}</Text>
                  </View>
                  <View style={styles.categoryInputRow}>
                    <Text style={styles.yenSmall}>¥</Text>
                    <TextInput
                      style={styles.categoryInput}
                      value={cb.amount > 0 ? String(cb.amount) : ''}
                      onChangeText={(v) => handleCategoryAmountChange(cb.category, v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.textLight}
                    />
                  </View>
                </View>
              );
            })}
            <View style={styles.totalSummary}>
              <Text style={styles.totalSummaryLabel}>合計</Text>
              <Text style={styles.totalSummaryAmount}>
                ¥{categoryTotal.toLocaleString()}
              </Text>
            </View>
          </Card>
        )}

        {/* 保存ボタン */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.textOnPrimary} />
              <Text style={styles.saveButtonText}>予算を保存</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  modeSelector: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  modeButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  modeButtonTextActive: {
    color: COLORS.textOnPrimary,
  },
  totalCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  totalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  yen: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: SPACING.xs,
  },
  totalInput: {
    flex: 1,
    fontSize: FONT_SIZE.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingVertical: SPACING.md,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: 8,
    ...SHADOWS.medium,
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonEmoji: {
    fontSize: 22,
  },
  aiButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
  },
  resultCard: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  resultNote: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  categoryLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  categoryPct: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
  categoryInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    minWidth: 120,
  },
  yenSmall: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginRight: 4,
  },
  categoryInput: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '600',
    paddingVertical: SPACING.xs + 2,
    flex: 1,
    textAlign: 'right',
  },
  totalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
  },
  totalSummaryLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  totalSummaryAmount: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  totalSummaryMismatch: {
    color: COLORS.warning,
  },
  mismatchWarning: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.md,
    gap: 8,
    ...SHADOWS.medium,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
  },
});

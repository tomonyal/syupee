import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../components';
import { useExpenseStore } from '../store';
import { getExpenseById, updateExpense, updateExpenseItems } from '../database';
import { Expense, ExpenseCategory, ExpenseItem } from '../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORIES } from '../constants';

function getDominantCategory(items: ExpenseItem[], fallback: ExpenseCategory): ExpenseCategory {
  if (items.length === 0) return fallback;

  const categoryTotals = new Map<ExpenseCategory, number>();
  for (const item of items) {
    const key = item.category ?? fallback;
    const subtotal = (item.price || 0) * (item.quantity || 1);
    categoryTotals.set(key, (categoryTotals.get(key) || 0) + subtotal);
  }

  let selected = fallback;
  let maxAmount = -1;
  for (const [categoryKey, amount] of categoryTotals.entries()) {
    if (amount > maxAmount) {
      selected = categoryKey;
      maxAmount = amount;
    }
  }

  return selected;
}

export default function EditExpenseScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { loadRecentExpenses, loadMonthlySummary, loadFilteredExpenses } = useExpenseStore();

  const [storeName, setStoreName] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [memo, setMemo] = useState('');
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadExpense();
  }, []);

  const loadExpense = async () => {
    const expenseId = route.params?.expenseId;
    if (!expenseId) return;

    const expense = await getExpenseById(expenseId);
    if (expense) {
      setStoreName(expense.storeName);
      setDate(expense.date);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setMemo(expense.memo);
      setItems(expense.items.map((item) => ({ ...item, category: item.category ?? expense.category })));
    }
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert('エラー', '金額を入力してください');
      return;
    }

    setIsLoading(true);
    try {
      const expenseId = route.params?.expenseId;
      const resolvedCategory = getDominantCategory(items, category);

      if (expenseId) {
        await updateExpense(expenseId, {
          storeName,
          date: date || new Date().toISOString().split('T')[0],
          amount: Number(amount),
          category: resolvedCategory,
          memo,
        });
        await updateExpenseItems(
          expenseId,
          items.map((item) => ({
            ...item,
            category: item.category ?? resolvedCategory,
          }))
        );
      }

      await Promise.all([loadRecentExpenses(), loadMonthlySummary(), loadFilteredExpenses()]);
      Alert.alert('保存完了', '支出を更新しました');
      navigation.goBack();
    } catch (error) {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { name: '', price: 0, quantity: 1, category }]);
  };

  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const updated = [...items];
    if (field === 'name') {
      updated[index] = { ...updated[index], name: value as string };
    } else if (field === 'price') {
      updated[index] = { ...updated[index], price: Number(value) || 0 };
    } else if (field === 'category') {
      updated[index] = { ...updated[index], category: value as ExpenseCategory };
    } else {
      updated[index] = { ...updated[index], quantity: Number(value) || 1 };
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* 基本情報 */}
      <Card title="📝 基本情報">
        <InputField label="店名" value={storeName} onChangeText={setStoreName} placeholder="店名を入力" />
        <InputField label="日付" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <InputField
          label="合計金額"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="numeric"
        />
        <InputField label="メモ" value={memo} onChangeText={setMemo} placeholder="メモ（任意）" multiline />
      </Card>

      {/* カテゴリ */}
      <Card title="🏷️ カテゴリ" style={styles.categoryCard}>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryItem,
                category === cat.key && { backgroundColor: cat.color + '20', borderColor: cat.color },
              ]}
              onPress={() => setCategory(cat.key)}
            >
              <Ionicons
                name={(cat.icon as any)}
                size={22}
                color={category === cat.key ? cat.color : COLORS.textLight}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.key && { color: cat.color, fontWeight: '700' },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* 明細 */}
      <Card title="🧾 明細" style={styles.itemsCard}>
        {items.map((item, idx) => (
          <View key={idx} style={styles.itemBlock}>
            <View style={styles.itemEditRow}>
              <TextInput
                style={[styles.input, styles.itemNameInput]}
                value={item.name}
                onChangeText={(v) => updateItem(idx, 'name', v)}
                placeholder="商品名"
              />
              <TextInput
                style={[styles.input, styles.itemPriceInput]}
                value={item.price ? String(item.price) : ''}
                onChangeText={(v) => updateItem(idx, 'price', v)}
                placeholder="価格"
                keyboardType="numeric"
              />
              <TouchableOpacity onPress={() => removeItem(idx)} style={styles.removeButton}>
                <Ionicons name="close-circle" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.itemCategoriesRow}>
                {CATEGORIES.map((cat) => {
                  const isSelected = (item.category ?? category) === cat.key;
                  return (
                    <TouchableOpacity
                      key={`${idx}-${cat.key}`}
                      style={[
                        styles.itemCategoryChip,
                        isSelected && { backgroundColor: cat.color + '20', borderColor: cat.color },
                      ]}
                      onPress={() => updateItem(idx, 'category', cat.key)}
                    >
                      <Text style={[styles.itemCategoryChipText, isSelected && { color: cat.color }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        ))}
        <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.addItemText}>明細を追加</Text>
        </TouchableOpacity>
      </Card>

      {/* 保存ボタン */}
      <Button
        title="保存する"
        onPress={handleSave}
        loading={isLoading}
        fullWidth
        size="large"
        style={styles.saveButton}
      />
    </ScrollView>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'numeric' | 'default';
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputField}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
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
    gap: SPACING.md,
  },
  inputField: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryCard: {
    // marginTop already from gap
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryItem: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '30%',
    minWidth: 90,
  },
  categoryLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  itemsCard: {},
  itemBlock: {
    marginBottom: SPACING.sm,
  },
  itemEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemCategoriesRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
    paddingBottom: 2,
  },
  itemCategoryChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
  },
  itemCategoryChipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  itemNameInput: {
    flex: 2,
  },
  itemPriceInput: {
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  addItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: SPACING.md,
  },
});

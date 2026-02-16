import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button } from '../components';
import { useExpenseStore } from '../store';
import { getExpenseById } from '../database';
import { Expense } from '../types';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, CATEGORY_MAP } from '../constants';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function ExpenseDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { removeExpense } = useExpenseStore();
  const [expense, setExpense] = useState<Expense | null>(null);

  useEffect(() => {
    loadExpense();
  }, [route.params?.expenseId]);

  const loadExpense = async () => {
    if (route.params?.expenseId) {
      const data = await getExpenseById(route.params.expenseId);
      setExpense(data);
    }
  };

  const handleDelete = () => {
    Alert.alert('支出を削除', 'この支出を削除しますか？', [
      { text: 'キャンセル' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          if (expense) {
            await removeExpense(expense.id);
            navigation.goBack();
          }
        },
      },
    ]);
  };

  if (!expense) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text>読み込み中...</Text>
      </View>
    );
  }

  const categoryInfo = CATEGORY_MAP[expense.category];
  const formattedDate = (() => {
    try {
      return format(new Date(expense.date), 'yyyy年M月d日 (EEEE)', { locale: ja });
    } catch {
      return expense.date;
    }
  })();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* レシート画像 */}
      {expense.receiptImageUri && (
        <Image
          source={{ uri: expense.receiptImageUri }}
          style={styles.receiptImage}
          resizeMode="contain"
        />
      )}

      {/* メイン情報 */}
      <Card style={styles.mainCard}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.categoryIcon,
              { backgroundColor: categoryInfo?.color + '20' },
            ]}
          >
            <Ionicons
              name={(categoryInfo?.icon as any) || 'ellipsis-horizontal'}
              size={28}
              color={categoryInfo?.color}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.storeName}>
              {expense.storeName || '不明な店舗'}
            </Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>

        <Text style={styles.amount}>
          ¥{expense.amount.toLocaleString()}
        </Text>

        <View style={styles.categoryBadge}>
          <Text style={[styles.categoryText, { color: categoryInfo?.color }]}>
            {categoryInfo?.label || 'その他'}
          </Text>
        </View>
      </Card>

      {/* 明細 */}
      {expense.items.length > 0 && (
        <Card title="🧾 明細" style={styles.itemsCard}>
          {expense.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemPrice}>
                ¥{(item.price * item.quantity).toLocaleString()}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>合計</Text>
            <Text style={styles.totalValue}>
              ¥{expense.amount.toLocaleString()}
            </Text>
          </View>
        </Card>
      )}

      {/* メモ */}
      {expense.memo && (
        <Card title="📝 メモ" style={styles.memoCard}>
          <Text style={styles.memo}>{expense.memo}</Text>
        </Card>
      )}

      {/* アクション */}
      <View style={styles.actions}>
        <Button
          title="編集"
          onPress={() => navigation.navigate('EditExpense', { expenseId: expense.id })}
          variant="outline"
          icon={<Ionicons name="create-outline" size={18} color={COLORS.primary} />}
          style={{ flex: 1 }}
        />
        <Button
          title="削除"
          onPress={handleDelete}
          variant="ghost"
          icon={<Ionicons name="trash-outline" size={18} color={COLORS.error} />}
          textStyle={{ color: COLORS.error }}
          style={{ flex: 1 }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.border,
  },
  mainCard: {
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.md,
  },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  headerInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  date: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  amount: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    marginVertical: SPACING.sm,
  },
  categoryBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  itemsCard: {
    marginBottom: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  itemName: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  itemQty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.md,
  },
  itemPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.text,
    minWidth: 80,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
  },
  totalLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '900',
    color: COLORS.primary,
  },
  memoCard: {
    marginBottom: SPACING.md,
  },
  memo: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
});

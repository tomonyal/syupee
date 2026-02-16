import { getDatabase } from './connection';
import { MonthlyBudget, CategoryBudget, ExpenseCategory } from '../types';
import { CATEGORIES } from '../constants';

/**
 * 月間予算（合計＋カテゴリ別）を保存
 */
export async function saveBudget(
  month: string,
  totalBudget: number,
  categoryBudgets: CategoryBudget[],
  isRecurring: boolean = false
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // recurring設定の場合、既存のrecurringフラグをすべて解除
  if (isRecurring) {
    await db.runAsync('UPDATE budget_totals SET is_recurring = 0 WHERE is_recurring = 1');
  }

  // 合計予算を保存
  await db.runAsync(
    'INSERT OR REPLACE INTO budget_totals (month, total_budget, is_recurring, updated_at) VALUES (?, ?, ?, ?)',
    [month, totalBudget, isRecurring ? 1 : 0, now]
  );

  // カテゴリ別予算を保存
  for (const cb of categoryBudgets) {
    await db.runAsync(
      'INSERT OR REPLACE INTO budgets (month, category, amount, updated_at) VALUES (?, ?, ?, ?)',
      [month, cb.category, cb.amount, now]
    );
  }
}

/**
 * 月間予算を取得（対象月になければ recurring な予算をフォールバック）
 */
export async function getBudget(month: string): Promise<MonthlyBudget | null> {
  const db = await getDatabase();

  // 対象月の予算を取得
  let totalRow = await db.getFirstAsync<{ month: string; total_budget: number; is_recurring: number; updated_at: string }>(
    'SELECT month, total_budget, is_recurring, updated_at FROM budget_totals WHERE month = ?',
    [month]
  );

  let sourceMonth = month;

  // 対象月になければ recurring 予算をフォールバック
  if (!totalRow) {
    const recurringRow = await db.getFirstAsync<{ month: string; total_budget: number; is_recurring: number; updated_at: string }>(
      'SELECT month, total_budget, is_recurring, updated_at FROM budget_totals WHERE is_recurring = 1 LIMIT 1'
    );
    if (!recurringRow) return null;
    totalRow = recurringRow;
    sourceMonth = recurringRow.month;
  }

  // カテゴリ別予算を取得（ソース月から）
  const rows = await db.getAllAsync<{ category: string; amount: number }>(
    'SELECT category, amount FROM budgets WHERE month = ? ORDER BY category',
    [sourceMonth]
  );

  const categoryBudgets: CategoryBudget[] = CATEGORIES.map((cat) => {
    const found = rows.find((r) => r.category === cat.key);
    return {
      category: cat.key as ExpenseCategory,
      amount: found?.amount ?? 0,
    };
  });

  return {
    month,
    totalBudget: totalRow.total_budget,
    categoryBudgets,
    updatedAt: totalRow.updated_at,
    isRecurring: totalRow.is_recurring === 1,
  };
}

/**
 * 予算を削除
 */
export async function deleteBudget(month: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM budgets WHERE month = ?', [month]);
  await db.runAsync('DELETE FROM budget_totals WHERE month = ?', [month]);
}

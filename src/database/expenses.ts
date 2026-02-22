import { getDatabase } from './connection';
import { Expense, ExpenseItem, ExpenseCategory, MonthlySummary, CategoryBreakdown } from '../types';
import { v4Generator } from '../utils/uuid';

// ============================
// 支出 CRUD
// ============================

export async function insertExpense(
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const db = await getDatabase();
  const id = v4Generator();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO expenses (id, amount, category, store_name, date, memo, receipt_image_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, expense.amount, expense.category, expense.storeName, expense.date, expense.memo, expense.receiptImageUri ?? null, now, now]
  );

  // 明細を挿入
  for (const item of expense.items) {
    await db.runAsync(
      `INSERT INTO expense_items (expense_id, name, price, quantity, category) VALUES (?, ?, ?, ?, ?)`,
      [id, item.name, item.price, item.quantity, item.category ?? expense.category]
    );
  }

  return id;
}

export async function updateExpense(
  id: string,
  expense: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'items'>>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: any[] = [];

  if (expense.amount !== undefined) { fields.push('amount = ?'); values.push(expense.amount); }
  if (expense.category !== undefined) { fields.push('category = ?'); values.push(expense.category); }
  if (expense.storeName !== undefined) { fields.push('store_name = ?'); values.push(expense.storeName); }
  if (expense.date !== undefined) { fields.push('date = ?'); values.push(expense.date); }
  if (expense.memo !== undefined) { fields.push('memo = ?'); values.push(expense.memo); }
  if (expense.receiptImageUri !== undefined) { fields.push('receipt_image_uri = ?'); values.push(expense.receiptImageUri); }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  if (fields.length > 1) {
    await db.runAsync(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

export async function updateExpenseItems(expenseId: string, items: ExpenseItem[]): Promise<void> {
  const db = await getDatabase();
  const expenseRow = await db.getFirstAsync<{ category: string }>(
    'SELECT category FROM expenses WHERE id = ?',
    [expenseId]
  );
  const fallbackCategory = expenseRow?.category as ExpenseCategory | undefined;

  await db.runAsync('DELETE FROM expense_items WHERE expense_id = ?', [expenseId]);
  for (const item of items) {
    await db.runAsync(
      `INSERT INTO expense_items (expense_id, name, price, quantity, category) VALUES (?, ?, ?, ?, ?)`,
      [expenseId, item.name, item.price, item.quantity, item.category ?? fallbackCategory ?? 'other']
    );
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM expenses WHERE id = ?',
    [id]
  );
  if (!row) return null;

  const items = await db.getAllAsync<any>(
    'SELECT * FROM expense_items WHERE expense_id = ?',
    [id]
  );

  return mapRowToExpense(row, items);
}

export async function getExpenses(options?: {
  month?: string; // YYYY-MM
  category?: ExpenseCategory;
  limit?: number;
  offset?: number;
}): Promise<Expense[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM expenses';
  const conditions: string[] = [];
  const params: any[] = [];

  if (options?.month) {
    conditions.push("strftime('%Y-%m', date) = ?");
    params.push(options.month);
  }
  if (options?.category) {
    conditions.push(`(
      category = ?
      OR EXISTS (
        SELECT 1 FROM expense_items ei
        WHERE ei.expense_id = expenses.id AND ei.category = ?
      )
    )`);
    params.push(options.category, options.category);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY date DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = await db.getAllAsync<any>(query, params);
  const expenses: Expense[] = [];

  for (const row of rows) {
    const items = await db.getAllAsync<any>(
      'SELECT * FROM expense_items WHERE expense_id = ?',
      [row.id]
    );
    expenses.push(mapRowToExpense(row, items));
  }

  return expenses;
}

export async function getRecentExpenses(limit: number = 10): Promise<Expense[]> {
  return getExpenses({ limit });
}

// ============================
// 月間サマリー
// ============================

export async function getMonthlySummary(month: string): Promise<MonthlySummary> {
  const db = await getDatabase();

  const totalResult = await db.getFirstAsync<{ total: number; count: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
     FROM expenses WHERE strftime('%Y-%m', date) = ?`,
    [month]
  );

  const totalAmount = totalResult?.total ?? 0;
  const expenses = await getExpenses({ month });
  const breakdownMap = new Map<ExpenseCategory, { amount: number; count: number }>();

  for (const expense of expenses) {
    if (expense.items.length > 0) {
      for (const item of expense.items) {
        const category = (item.category ?? expense.category) as ExpenseCategory;
        const itemAmount = (item.price || 0) * (item.quantity || 1);
        if (itemAmount <= 0) continue;

        const prev = breakdownMap.get(category) ?? { amount: 0, count: 0 };
        breakdownMap.set(category, {
          amount: prev.amount + itemAmount,
          count: prev.count + 1,
        });
      }
      continue;
    }

    const prev = breakdownMap.get(expense.category) ?? { amount: 0, count: 0 };
    breakdownMap.set(expense.category, {
      amount: prev.amount + expense.amount,
      count: prev.count + 1,
    });
  }

  const breakdownTotal = Array.from(breakdownMap.values()).reduce((sum, row) => sum + row.amount, 0);
  const percentageBase = breakdownTotal > 0 ? breakdownTotal : totalAmount;

  const categoryBreakdown: CategoryBreakdown[] = Array.from(breakdownMap.entries())
    .map(([category, value]) => ({
      category,
      amount: value.amount,
      percentage: percentageBase > 0 ? (value.amount / percentageBase) * 100 : 0,
      count: value.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    month,
    totalAmount,
    categoryBreakdown,
    expenseCount: totalResult?.count ?? 0,
  };
}

export async function getMultiMonthSummary(months: number = 3): Promise<MonthlySummary[]> {
  const summaries: MonthlySummary[] = [];
  const now = new Date();

  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    summaries.push(await getMonthlySummary(month));
  }

  return summaries;
}

// ============================
// ヘルパー
// ============================

function mapRowToExpense(row: any, itemRows: any[]): Expense {
  return {
    id: row.id,
    amount: row.amount,
    category: row.category as ExpenseCategory,
    storeName: row.store_name,
    date: row.date,
    memo: row.memo || '',
    receiptImageUri: row.receipt_image_uri || undefined,
    items: itemRows.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category ? (item.category as ExpenseCategory) : undefined,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

import { getDatabase } from './connection';
import { CoinTransaction } from '../types';
import { v4Generator as generateUUID } from '../utils/uuid';

/**
 * コイン残高を取得
 */
export async function getCoinBalance(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM coin_transactions`
  );
  return result?.total ?? 0;
}

/**
 * コイン取引を追加
 */
export async function addCoinTransaction(
  type: 'purchase' | 'use' | 'bonus',
  amount: number,
  description: string
): Promise<CoinTransaction> {
  const db = await getDatabase();
  const id = generateUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO coin_transactions (id, type, amount, description, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, type, amount, description, now]
  );

  return { id, type, amount, description, createdAt: now };
}

/**
 * コインを購入
 */
export async function purchaseCoins(coins: number, price: number): Promise<CoinTransaction> {
  return addCoinTransaction('purchase', coins, `${coins}コイン購入 (¥${price})`);
}

/**
 * コインを消費（レシート読み込み）
 */
export async function useCoinsForScan(cost: number): Promise<CoinTransaction> {
  const balance = await getCoinBalance();
  if (balance < cost) {
    throw new Error('コインが足りません');
  }
  return addCoinTransaction('use', -cost, `レシート読み込み (${cost}コイン)`);
}

/**
 * ボーナスコインを付与
 */
export async function addBonusCoins(amount: number, reason: string): Promise<CoinTransaction> {
  return addCoinTransaction('bonus', amount, reason);
}

/**
 * コイン取引履歴を取得
 */
export async function getCoinTransactions(limit: number = 50): Promise<CoinTransaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    type: string;
    amount: number;
    description: string;
    created_at: string;
  }>(
    `SELECT * FROM coin_transactions ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.type as 'purchase' | 'use' | 'bonus',
    amount: row.amount,
    description: row.description,
    createdAt: row.created_at,
  }));
}

/**
 * 今月のスキャン回数を取得（ランク算出用）
 */
export async function getMonthlyScansCount(month?: string): Promise<number> {
  const db = await getDatabase();
  const targetMonth = month || getCurrentMonth();
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM coin_transactions
     WHERE type = 'use' AND description LIKE '%レシート%'
     AND created_at LIKE ?`,
    [`${targetMonth}%`]
  );
  return result?.count ?? 0;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

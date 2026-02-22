import { getDatabase } from './connection';
import { CoinTransaction, MonthlyRankHistory, UserRank } from '../types';
import { v4Generator as generateUUID } from '../utils/uuid';
import { getRankFromScans, RANK_MAP } from '../constants';

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
  
  // usage_trackingテーブルからOCR回数を取得（コイン消費有無に関わらず全スキャンを含む）
  const result = await db.getFirstAsync<{ ocr_count: number }>(
    `SELECT ocr_count FROM usage_tracking WHERE month = ?`,
    [targetMonth]
  );
  
  return result?.ocr_count ?? 0;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 前月のランクを履歴に保存し、報酬を付与して今月のスキャン数をリセット
 */
export async function processMonthlyRankReset(): Promise<{ rewardCoins: number; lastRank: UserRank } | null> {
  const db = await getDatabase();
  const now = new Date();
  const currentMonth = getCurrentMonth();
  
  // 前月を計算
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  
  // 前月の履歴が既に存在するかチェック
  const existingHistory = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM monthly_rank_history WHERE month = ?',
    [lastMonth]
  );
  
  if (existingHistory) {
    // 既にリセット済み
    return null;
  }
  
  // 前月のスキャン数を取得
  const lastMonthScans = await getMonthlyScansCount(lastMonth);
  
  if (lastMonthScans === 0) {
    // 前月の記録がない場合はスキップ
    return null;
  }
  
  // 前月のランクを決定
  const lastRankInfo = getRankFromScans(lastMonthScans);
  const rewardCoins = lastRankInfo.rewardCoins;
  
  // 履歴を保存
  const historyId = generateUUID();
  await db.runAsync(
    `INSERT INTO monthly_rank_history (id, month, rank, scan_count, reward_coins, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [historyId, lastMonth, lastRankInfo.key, lastMonthScans, rewardCoins, new Date().toISOString()]
  );
  
  // 報酬コインを付与
  if (rewardCoins > 0) {
    await addBonusCoins(
      rewardCoins,
      `${lastMonth}の${lastRankInfo.label}ランク報酬 🎉`
    );
  }
  
  return { rewardCoins, lastRank: lastRankInfo.key };
}

/**
 * 月次ランク履歴を取得
 */
export async function getMonthlyRankHistory(limit: number = 12): Promise<MonthlyRankHistory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    month: string;
    rank: string;
    scan_count: number;
    reward_coins: number;
    created_at: string;
  }>(
    `SELECT * FROM monthly_rank_history ORDER BY month DESC LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    month: row.month,
    rank: row.rank as UserRank,
    scanCount: row.scan_count,
    rewardCoins: row.reward_coins,
    createdAt: row.created_at,
  }));
}

/**
 * 指定月のランク履歴を取得
 */
export async function getMonthRankHistory(month: string): Promise<MonthlyRankHistory | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    id: string;
    month: string;
    rank: string;
    scan_count: number;
    reward_coins: number;
    created_at: string;
  }>(
    `SELECT * FROM monthly_rank_history WHERE month = ?`,
    [month]
  );

  if (!row) return null;

  return {
    id: row.id,
    month: row.month,
    rank: row.rank as UserRank,
    scanCount: row.scan_count,
    rewardCoins: row.reward_coins,
    createdAt: row.created_at,
  };
}

import { getDatabase } from './connection';
import { v4Generator as generateUUID } from '../utils/uuid';

/**
 * 現在の年月を YYYY-MM 形式で返す
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * OCR枠の残高を取得（繰越分）
 */
export async function getOCRQuotaBalance(month?: string): Promise<number> {
  const db = await getDatabase();
  const targetMonth = month || getCurrentMonth();

  const row = await db.getFirstAsync<{ quota_remaining: number }>(
    'SELECT quota_remaining FROM ocr_quota_balance WHERE month = ?',
    [targetMonth]
  );

  return row?.quota_remaining ?? 0;
}

/**
 * OCR枠を購入（コインで枠を購入）
 */
export async function purchaseOCRQuota(quotaCount: number, coinCost: number): Promise<void> {
  const db = await getDatabase();
  const id = generateUUID();
  const month = getCurrentMonth();
  const now = new Date().toISOString();

  // 購入履歴を記録
  await db.runAsync(
    `INSERT INTO ocr_quota_purchases (id, quota_count, coin_cost, created_at) VALUES (?, ?, ?, ?)`,
    [id, quotaCount, coinCost, now]
  );

  // 今月の残高に加算
  await db.runAsync(
    `INSERT INTO ocr_quota_balance (month, quota_remaining, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(month) DO UPDATE SET
       quota_remaining = quota_remaining + ?,
       updated_at = ?`,
    [month, quotaCount, now, quotaCount, now]
  );
}

/**
 * OCR枠を1つ消費
 */
export async function useOCRQuota(): Promise<boolean> {
  const db = await getDatabase();
  const month = getCurrentMonth();
  const balance = await getOCRQuotaBalance(month);

  if (balance <= 0) {
    return false;
  }

  await db.runAsync(
    `UPDATE ocr_quota_balance 
     SET quota_remaining = quota_remaining - 1, updated_at = datetime('now')
     WHERE month = ?`,
    [month]
  );

  return true;
}

/**
 * 前月から今月へ枠を繰り越す
 */
export async function carryOverQuota(): Promise<void> {
  const db = await getDatabase();
  const currentMonth = getCurrentMonth();
  
  // 前月を計算（年跨ぎ対応）
  const now = new Date();
  const priorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthRow = await db.getFirstAsync<{ quota_remaining: number }>(
    'SELECT quota_remaining FROM ocr_quota_balance WHERE month = ?',
    [lastMonth]
  );

  const carryOver = lastMonthRow?.quota_remaining ?? 0;

  if (carryOver > 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO ocr_quota_balance (month, quota_remaining, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(month) DO UPDATE SET
         quota_remaining = quota_remaining + ?,
         updated_at = ?`,
      [currentMonth, carryOver, now, carryOver, now]
    );
  }
}

/**
 * 購入履歴を取得
 */
export async function getQuotaPurchaseHistory(limit: number = 50): Promise<Array<{
  id: string;
  quotaCount: number;
  coinCost: number;
  createdAt: string;
}>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    quota_count: number;
    coin_cost: number;
    created_at: string;
  }>(
    `SELECT * FROM ocr_quota_purchases ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );

  return rows.map((row) => ({
    id: row.id,
    quotaCount: row.quota_count,
    coinCost: row.coin_cost,
    createdAt: row.created_at,
  }));
}

/**
 * AI相談枠の残高を取得（繰越分）
 */
export async function getChatQuotaBalance(month?: string): Promise<number> {
  const db = await getDatabase();
  const targetMonth = month || getCurrentMonth();

  const row = await db.getFirstAsync<{ quota_remaining: number }>(
    'SELECT quota_remaining FROM chat_quota_balance WHERE month = ?',
    [targetMonth]
  );

  return row?.quota_remaining ?? 0;
}

/**
 * AI相談枠を購入（コインで枠を購入）
 */
export async function purchaseChatQuota(quotaCount: number, coinCost: number): Promise<void> {
  const db = await getDatabase();
  const id = generateUUID();
  const month = getCurrentMonth();
  const now = new Date().toISOString();

  // 購入履歴を記録
  await db.runAsync(
    `INSERT INTO chat_quota_purchases (id, quota_count, coin_cost, created_at) VALUES (?, ?, ?, ?)`,
    [id, quotaCount, coinCost, now]
  );

  // 今月の残高に加算
  await db.runAsync(
    `INSERT INTO chat_quota_balance (month, quota_remaining, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(month) DO UPDATE SET
       quota_remaining = quota_remaining + ?,
       updated_at = ?`,
    [month, quotaCount, now, quotaCount, now]
  );
}

/**
 * AI相談枠を1つ消費
 */
export async function useChatQuota(): Promise<boolean> {
  const db = await getDatabase();
  const month = getCurrentMonth();
  const balance = await getChatQuotaBalance(month);

  if (balance <= 0) {
    return false;
  }

  await db.runAsync(
    `UPDATE chat_quota_balance 
     SET quota_remaining = quota_remaining - 1, updated_at = datetime('now')
     WHERE month = ?`,
    [month]
  );

  return true;
}

/**
 * AI相談枠を前月から繰り越す
 */
export async function carryOverChatQuota(): Promise<void> {
  const db = await getDatabase();
  const currentMonth = getCurrentMonth();
  
  // 前月を計算（年跨ぎ対応）
  const now = new Date();
  const priorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, '0')}`;

  const lastMonthRow = await db.getFirstAsync<{ quota_remaining: number }>(
    'SELECT quota_remaining FROM chat_quota_balance WHERE month = ?',
    [lastMonth]
  );

  const carryOver = lastMonthRow?.quota_remaining ?? 0;

  if (carryOver > 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO chat_quota_balance (month, quota_remaining, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(month) DO UPDATE SET
         quota_remaining = quota_remaining + ?,
         updated_at = ?`,
      [currentMonth, carryOver, now, carryOver, now]
    );
  }
}

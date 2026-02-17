import { getDatabase } from './connection';

/**
 * 現在の年月を YYYY-MM 形式で返す
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 指定月の使用回数を取得（無ければ初期化）
 */
export async function getMonthlyUsage(month?: string): Promise<{ ocrCount: number; chatCount: number }> {
  const db = await getDatabase();
  const targetMonth = month || getCurrentMonth();

  const row = await db.getFirstAsync<{ ocr_count: number; chat_count: number }>(
    'SELECT ocr_count, chat_count FROM usage_tracking WHERE month = ?',
    [targetMonth]
  );

  if (row) {
    return { ocrCount: row.ocr_count, chatCount: row.chat_count };
  }

  return { ocrCount: 0, chatCount: 0 };
}

/**
 * OCR使用回数を+1（ローカルDB）
 */
export async function incrementLocalOCRUsage(): Promise<number> {
  const db = await getDatabase();
  const month = getCurrentMonth();

  // UPSERT: 存在すれば+1、無ければ新規作成
  await db.runAsync(
    `INSERT INTO usage_tracking (month, ocr_count, chat_count, updated_at)
     VALUES (?, 1, 0, datetime('now'))
     ON CONFLICT(month) DO UPDATE SET
       ocr_count = ocr_count + 1,
       updated_at = datetime('now')`,
    [month]
  );

  const row = await db.getFirstAsync<{ ocr_count: number }>(
    'SELECT ocr_count FROM usage_tracking WHERE month = ?',
    [month]
  );

  return row?.ocr_count ?? 1;
}

/**
 * AI相談使用回数を+1（ローカルDB）
 */
export async function incrementLocalChatUsage(): Promise<number> {
  const db = await getDatabase();
  const month = getCurrentMonth();

  await db.runAsync(
    `INSERT INTO usage_tracking (month, ocr_count, chat_count, updated_at)
     VALUES (?, 0, 1, datetime('now'))
     ON CONFLICT(month) DO UPDATE SET
       chat_count = chat_count + 1,
       updated_at = datetime('now')`,
    [month]
  );

  const row = await db.getFirstAsync<{ chat_count: number }>(
    'SELECT chat_count FROM usage_tracking WHERE month = ?',
    [month]
  );

  return row?.chat_count ?? 1;
}

/**
 * 使用回数をリセット（テスト・デバッグ用）
 */
export async function resetUsage(month?: string): Promise<void> {
  const db = await getDatabase();
  const targetMonth = month || getCurrentMonth();

  await db.runAsync(
    `DELETE FROM usage_tracking WHERE month = ?`,
    [targetMonth]
  );
}

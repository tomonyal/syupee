import * as SQLite from 'expo-sqlite';

const DB_NAME = 'syupee.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeDatabase(db);
  await migrateDatabase(db);
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      store_name TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      memo TEXT DEFAULT '',
      receipt_image_uri TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      category TEXT,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expense_items_expense_id ON expense_items(expense_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);

    CREATE TABLE IF NOT EXISTS budgets (
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (month, category)
    );

    CREATE TABLE IF NOT EXISTS budget_totals (
      month TEXT PRIMARY KEY,
      total_budget REAL NOT NULL DEFAULT 0,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coin_transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('purchase', 'use', 'bonus')),
      amount INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_coin_transactions_created ON coin_transactions(created_at);

    CREATE TABLE IF NOT EXISTS usage_tracking (
      month TEXT PRIMARY KEY,
      ocr_count INTEGER NOT NULL DEFAULT 0,
      chat_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ocr_quota_purchases (
      id TEXT PRIMARY KEY,
      quota_count INTEGER NOT NULL,
      coin_cost INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ocr_quota_balance (
      month TEXT PRIMARY KEY,
      quota_remaining INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ocr_quota_purchases_created ON ocr_quota_purchases(created_at);
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * 既存DBのマイグレーション（カラム追加など）
 */
async function migrateDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // budget_totals に is_recurring カラムを追加（既にあれば無視）
    await database.execAsync(
      `ALTER TABLE budget_totals ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    // カラムが既に存在する場合はエラーになるので無視
  }

  try {
    // expense_items に category カラムを追加（既にあれば無視）
    await database.execAsync(
      `ALTER TABLE expense_items ADD COLUMN category TEXT`
    );
  } catch {
    // カラムが既に存在する場合はエラーになるので無視
  }

  try {
    // AI相談枠の購入履歴テーブルと残高テーブルを追加
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS chat_quota_purchases (
        id TEXT PRIMARY KEY,
        quota_count INTEGER NOT NULL,
        coin_cost INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_quota_balance (
        month TEXT PRIMARY KEY,
        quota_remaining INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_chat_quota_purchases_created ON chat_quota_purchases(created_at);
    `);
  } catch {
    // テーブルが既に存在する場合はエラーになるので無視
  }

  try {
    // 月次ランク履歴テーブルを追加
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS monthly_rank_history (
        id TEXT PRIMARY KEY,
        month TEXT NOT NULL,
        rank TEXT NOT NULL,
        scan_count INTEGER NOT NULL,
        reward_coins INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_monthly_rank_history_month ON monthly_rank_history(month);
    `);
  } catch {
    // テーブルが既に存在する場合はエラーになるので無視
  }

  try {
    // シーズンランク履歴テーブルを追加
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS season_rank_history (
        id TEXT PRIMARY KEY,
        season_id TEXT NOT NULL,
        rank TEXT NOT NULL,
        scan_count INTEGER NOT NULL,
        percentile INTEGER NOT NULL,
        total_users INTEGER NOT NULL,
        reward_coins INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_season_rank_history_season ON season_rank_history(season_id);
    `);
  } catch {
    // テーブルが既に存在する場合はエラーになるので無視
  }
}

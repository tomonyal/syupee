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
}

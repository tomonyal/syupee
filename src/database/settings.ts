import { getDatabase } from './connection';

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM user_settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function deleteSetting(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM user_settings WHERE key = ?', [key]);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT * FROM user_settings'
  );
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

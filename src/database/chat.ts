import { getDatabase } from './connection';
import { ChatMessage } from '../types';
import { v4Generator } from '../utils/uuid';
import { CHAT_CONTEXT_TURNS } from '../constants';

export async function insertChatMessage(
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const db = await getDatabase();
  const id = v4Generator();
  const timestamp = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO chat_messages (id, role, content, timestamp) VALUES (?, ?, ?, ?)',
    [id, role, content, timestamp]
  );

  return { id, role, content, timestamp };
}

export async function getRecentChatMessages(
  turns: number = CHAT_CONTEXT_TURNS
): Promise<ChatMessage[]> {
  const db = await getDatabase();
  // 直近N往復 = 2*N メッセージ
  const limit = turns * 2;
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT ?',
    [limit]
  );

  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    timestamp: row.timestamp,
  }));
}

export async function getAllChatMessages(): Promise<ChatMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM chat_messages ORDER BY timestamp ASC'
  );
  return rows.map((row) => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    timestamp: row.timestamp,
  }));
}

export async function clearChatHistory(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM chat_messages');
}

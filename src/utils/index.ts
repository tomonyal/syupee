export { v4Generator } from './uuid';
export { exportCSV, importCSV } from './csv';

/**
 * 金額をフォーマット
 */
export function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/**
 * 現在の月を YYYY-MM 形式で取得
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

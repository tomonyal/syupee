import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getExpenses, insertExpense } from '../database';
import { Expense, ExpenseCategory } from '../types';
import { CATEGORY_MAP } from '../constants';
import { format } from 'date-fns';

/**
 * 全支出データをCSVにエクスポートし、共有ダイアログを開く
 */
export async function exportCSV(): Promise<void> {
  const expenses = await getExpenses();

  if (expenses.length === 0) {
    throw new Error('エクスポートする支出データがありません');
  }

  // CSVヘッダー
  const header = '日付,店名,カテゴリ,金額,メモ';

  // CSVデータ行
  const rows = expenses.map((e) => {
    const categoryLabel = CATEGORY_MAP[e.category]?.label || 'その他';
    return [
      e.date,
      escapeCSVField(e.storeName),
      categoryLabel,
      e.amount,
      escapeCSVField(e.memo),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [header, ...rows].join('\n'); // BOM付きUTF-8

  // ファイル名: syupee_YYYYMMDD.csv
  const fileName = `syupee_${format(new Date(), 'yyyyMMdd')}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  // ファイル書き込み
  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: 'utf8',
  });

  // 共有ダイアログ
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: '支出データをエクスポート',
    });
  } else {
    throw new Error('この端末では共有機能が利用できません');
  }
}

/**
 * CSVファイルをインポートして支出データに変換・保存
 * @returns インポートされた件数
 */
export async function importCSV(): Promise<number> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error('ファイルが選択されませんでした');
  }

  const fileUri = result.assets[0].uri;
  const content = await FileSystem.readAsStringAsync(fileUri, {
    encoding: 'utf8',
  });

  // BOM除去
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error('CSVファイルにデータがありません');
  }

  // ヘッダースキップ
  const dataLines = lines.slice(1);
  let importedCount = 0;

  for (const line of dataLines) {
    try {
      const fields = parseCSVLine(line);
      if (fields.length < 4) continue;

      const [date, storeName, categoryLabel, amountStr, memo] = fields;
      const amount = Number(amountStr);
      if (isNaN(amount) || amount <= 0) continue;

      // カテゴリラベルからキーを逆引き
      const category = findCategoryByLabel(categoryLabel);

      await insertExpense({
        amount,
        category,
        storeName: storeName || '',
        date: date || new Date().toISOString().split('T')[0],
        items: [],
        memo: memo || '',
      });

      importedCount++;
    } catch {
      // 個別行のエラーはスキップ
      continue;
    }
  }

  return importedCount;
}

/**
 * CSVフィールドのエスケープ
 */
function escapeCSVField(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * CSVの行をパース（ダブルクォート対応）
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * カテゴリラベルからキーを取得
 */
function findCategoryByLabel(label: string): ExpenseCategory {
  for (const [key, info] of Object.entries(CATEGORY_MAP)) {
    if (info.label === label) {
      return key as ExpenseCategory;
    }
  }
  return 'other';
}

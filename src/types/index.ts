// 支出データ型
export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  storeName: string;
  date: string; // ISO 8601 format
  items: ExpenseItem[];
  memo: string;
  receiptImageUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseItem {
  name: string;
  price: number;
  quantity: number;
}

// カテゴリ
export type ExpenseCategory =
  | 'food'
  | 'daily_necessities'
  | 'transportation'
  | 'eating_out'
  | 'hobby'
  | 'clothing'
  | 'medical'
  | 'communication'
  | 'utilities'
  | 'education'
  | 'other';

// カテゴリ情報
export interface CategoryInfo {
  key: ExpenseCategory;
  label: string;
  icon: string;
  color: string;
}

// OCR結果
export interface OCRResult {
  rawText: string;
  confidence: number;
}

// AI構造化結果
export interface ParsedReceipt {
  storeName: string;
  date: string;
  items: ExpenseItem[];
  totalAmount: number;
  suggestedCategory: ExpenseCategory;
}

// チャットメッセージ
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ユーザー情報
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  plan: SubscriptionPlan;
  ocrUsedThisMonth: number;
  chatUsedThisMonth: number;
  planResetDate: string;
}

// サブスクリプションプラン
export type SubscriptionPlan = 'light' | 'standard' | 'premium';

export interface PlanInfo {
  key: SubscriptionPlan;
  label: string;
  price: number;
  ocrLimit: number;
  chatLimit: number;
  description: string;
}

// 月間サマリー
export interface MonthlySummary {
  month: string; // YYYY-MM
  totalAmount: number;
  categoryBreakdown: CategoryBreakdown[];
  expenseCount: number;
}

export interface CategoryBreakdown {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  count: number;
}

// 予算設定
export interface CategoryBudget {
  category: ExpenseCategory;
  amount: number;
}

export interface MonthlyBudget {
  month: string; // YYYY-MM
  totalBudget: number;
  categoryBudgets: CategoryBudget[];
  updatedAt: string;
  isRecurring?: boolean;
}

// CSVインポート/エクスポート
export interface CSVRow {
  date: string;
  storeName: string;
  category: string;
  amount: number;
  memo: string;
}

// ナビゲーション型
export type RootTabParamList = {
  Home: undefined;
  Scan: undefined;
  Expenses: undefined;
  Chat: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  ExpenseDetail: { expenseId: string };
  EditExpense: { expenseId?: string; parsedReceipt?: ParsedReceipt };
  PlanSelect: undefined;
  BudgetSetting: undefined;
};

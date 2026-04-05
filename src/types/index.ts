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
  category?: ExpenseCategory;
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
  ocrQuotaBalance: number;
  chatQuotaBalance: number;
  planResetDate: string;
  initialCoinStatus?: InitialCoinStatus;
  initialCoinCouponCode?: string;
  deviceId?: string;
}

// 初回コインステータス
export type InitialCoinStatus = 'none' | 'requested' | 'issued' | 'redeemed';

// サブスクリプションプラン
export type SubscriptionPlan = 'free' | 'light' | 'standard' | 'premium';

// コインパッケージ
export interface CoinPackage {
  id: string;
  coins: number;
  price: number; // 円
  label: string;
  popular?: boolean;
}

// OCR枠パッケージ
export interface OCRQuotaPackage {
  id: string;
  quota: number; // 枠数
  coinCost: number; // コイン
  label: string;
  popular?: boolean;
}

// AI相談枠パッケージ
export interface ChatQuotaPackage {
  id: string;
  quota: number; // 枠数
  coinCost: number; // コイン
  label: string;
  popular?: boolean;
}

// コイン取引履歴
export interface CoinTransaction {
  id: string;
  type: 'purchase' | 'use' | 'bonus';
  amount: number; // 増減（購入: +, 使用: -）
  description: string;
  createdAt: string;
}

// ランク定義
export type UserRank = 'beginner' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface RankInfo {
  key: UserRank;
  label: string;
  icon: string;
  color: string;
  minScans: number; // 月間最低スキャン数（旧システム用）
  minPercentile: number; // 上位○%（0-100）、シーズンランク用
  description: string;
  rewardCoins: number; // シーズン末報酬コイン数
}

// 月次ランク履歴
export interface MonthlyRankHistory {
  id: string;
  month: string; // YYYY-MM
  rank: UserRank;
  scanCount: number;
  rewardCoins: number;
  createdAt: string;
}

// シーズンランク履歴
export interface SeasonRankHistory {
  id: string;
  seasonId: string; // "2026-Q1" 形式
  rank: UserRank;
  scanCount: number;
  percentile: number; // 上位○%
  totalUsers: number; // 総ユーザー数
  rewardCoins: number;
  createdAt: string;
}

// シーズンスキャン統計（全ユーザー集計用）
export interface SeasonScanStats {
  seasonId: string;
  userId: string;
  scanCount: number;
  updatedAt: string;
}

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
  CoinShop: undefined;
  QuotaPurchase: undefined;
  RankDetail: undefined;
  Terms: undefined;
  Privacy: undefined;
  CouponRedeem: undefined;
};

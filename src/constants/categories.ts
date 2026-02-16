import { CategoryInfo, PlanInfo, ExpenseCategory } from '../types';

// カテゴリ定義（住居を除外）
export const CATEGORIES: CategoryInfo[] = [
  { key: 'food', label: '食費', icon: 'cart', color: '#FF6B6B' },
  { key: 'daily_necessities', label: '日用品', icon: 'basket', color: '#FFA94D' },
  { key: 'transportation', label: '交通費', icon: 'train', color: '#51CF66' },
  { key: 'eating_out', label: '外食', icon: 'restaurant', color: '#FF922B' },
  { key: 'hobby', label: '趣味・娯楽', icon: 'game-controller', color: '#CC5DE8' },
  { key: 'clothing', label: '衣服', icon: 'shirt', color: '#F06595' },
  { key: 'medical', label: '医療', icon: 'medkit', color: '#20C997' },
  { key: 'communication', label: '通信費', icon: 'phone-portrait', color: '#339AF0' },
  { key: 'utilities', label: '水道光熱費', icon: 'flash', color: '#FCC419' },
  { key: 'education', label: '教育', icon: 'school', color: '#748FFC' },
  { key: 'other', label: 'その他', icon: 'ellipsis-horizontal', color: '#868E96' },
];

export const CATEGORY_MAP: Record<ExpenseCategory, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<ExpenseCategory, CategoryInfo>;

// プラン定義
export const PLANS: PlanInfo[] = [
  {
    key: 'light',
    label: 'ライト',
    price: 200,
    ocrLimit: 30,
    chatLimit: 10,
    description: 'お気軽に始めたい方に',
  },
  {
    key: 'standard',
    label: 'スタンダード',
    price: 500,
    ocrLimit: 100,
    chatLimit: 50,
    description: '日常的に使いたい方に',
  },
  {
    key: 'premium',
    label: 'プレミアム',
    price: 1000,
    ocrLimit: 300,
    chatLimit: 500,
    description: '本気で節約したい方に',
  },
];

export const PLAN_MAP: Record<string, PlanInfo> = Object.fromEntries(
  PLANS.map((p) => [p.key, p])
);

// チャットコンテキスト保持数（往復数）
export const CHAT_CONTEXT_TURNS = 5;

// アドバイス用の参照月数
export const ADVICE_MONTHS = 3;

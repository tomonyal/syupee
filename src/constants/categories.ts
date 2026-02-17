import { CategoryInfo, PlanInfo, ExpenseCategory, CoinPackage, RankInfo, UserRank } from '../types';

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

// コインパッケージ定義
export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'coin_50', coins: 50, price: 80, label: 'おためし' },
  { id: 'coin_100', coins: 100, price: 120, label: 'お得パック', popular: true },
  { id: 'coin_300', coins: 300, price: 320, label: 'たっぷりパック' },
  { id: 'coin_500', coins: 500, price: 480, label: 'メガパック' },
  { id: 'coin_1000', coins: 1000, price: 900, label: 'プレミアムパック' },
];

// コインパッケージIDからコイン数を引くマップ
export const COIN_PACKAGE_MAP: Record<string, CoinPackage> = Object.fromEntries(
  COIN_PACKAGES.map((p) => [p.id, p])
);

// レシート1回あたりのコイン消費
export const COIN_PER_SCAN = 10;

// ランク定義
export const RANKS: RankInfo[] = [
  { key: 'beginner', label: 'ビギナー', icon: '🐣', color: '#BDBDCC', minScans: 0, description: 'はじめの一歩！' },
  { key: 'bronze', label: 'ブロンズ', icon: '🥉', color: '#CD7F32', minScans: 5, description: '記録上手になってきた！' },
  { key: 'silver', label: 'シルバー', icon: '🥈', color: '#C0C0C0', minScans: 15, description: '節約の達人！' },
  { key: 'gold', label: 'ゴールド', icon: '🥇', color: '#FFD700', minScans: 30, description: '家計管理マスター！' },
  { key: 'platinum', label: 'プラチナ', icon: '💎', color: '#7C4DFF', minScans: 60, description: 'シュッピくんの親友！' },
  { key: 'diamond', label: 'ダイヤモンド', icon: '👑', color: '#FF6B9D', minScans: 100, description: '伝説の節約王！' },
];

export const RANK_MAP: Record<UserRank, RankInfo> = Object.fromEntries(
  RANKS.map((r) => [r.key, r])
) as Record<UserRank, RankInfo>;

// スキャン数からランクを取得
export function getRankFromScans(scanCount: number): RankInfo {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (scanCount >= r.minScans) rank = r;
  }
  return rank;
}

// 次のランクまでの残りスキャン数
export function getNextRankInfo(scanCount: number): { nextRank: RankInfo | null; remaining: number } {
  const currentRank = getRankFromScans(scanCount);
  const idx = RANKS.findIndex((r) => r.key === currentRank.key);
  if (idx >= RANKS.length - 1) return { nextRank: null, remaining: 0 };
  const nextRank = RANKS[idx + 1];
  return { nextRank, remaining: nextRank.minScans - scanCount };
}

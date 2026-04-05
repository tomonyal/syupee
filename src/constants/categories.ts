import { CategoryInfo, PlanInfo, ExpenseCategory, CoinPackage, OCRQuotaPackage, ChatQuotaPackage, RankInfo, UserRank } from '../types';

// カテゴリ定義（住居を除外）
export const CATEGORIES: CategoryInfo[] = [
  { key: 'food', label: '食費', icon: 'cart', color: '#FF9800' },
  { key: 'daily_necessities', label: '日用品', icon: 'basket', color: '#FFB74D' },
  { key: 'transportation', label: '交通費', icon: 'train', color: '#66BB6A' },
  { key: 'eating_out', label: '外食', icon: 'restaurant', color: '#FF7043' },
  { key: 'hobby', label: '趣味・娯楽', icon: 'game-controller', color: '#AB47BC' },
  { key: 'clothing', label: '衣服', icon: 'shirt', color: '#EC407A' },
  { key: 'medical', label: '医療', icon: 'medkit', color: '#26A69A' },
  { key: 'communication', label: '通信費', icon: 'phone-portrait', color: '#42A5F5' },
  { key: 'utilities', label: '水道光熱費', icon: 'flash', color: '#FFCA28' },
  { key: 'education', label: '教育', icon: 'school', color: '#5C6BC0' },
  { key: 'other', label: 'その他', icon: 'ellipsis-horizontal', color: '#78909C' },
];

export const CATEGORY_MAP: Record<ExpenseCategory, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<ExpenseCategory, CategoryInfo>;

// プラン定義
export const PLANS: PlanInfo[] = [
  {
    key: 'free',
    label: 'フリー',
    price: 0,
    ocrLimit: 0,
    chatLimit: 0,
    description: '無料でお試し',
  },
  {
    key: 'light',
    label: 'ライト',
    price: 300,
    ocrLimit: 30,
    chatLimit: 10,
    description: 'お気軽に始めたい方に',
  },
  {
    key: 'standard',
    label: 'スタンダード',
    price: 600,
    ocrLimit: 100,
    chatLimit: 50,
    description: '日常的に使いたい方に',
  },
  {
    key: 'premium',
    label: 'プレミアム',
    price: 1200,
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
  { id: 'coin_100', coins: 100, price: 200, label: 'おためし', popular: true },
  { id: 'coin_300', coins: 300, price: 500, label: 'お得パック' },
  { id: 'coin_500', coins: 500, price: 700, label: 'たっぷりパック' },
  { id: 'coin_1000', coins: 1000, price: 1200, label: 'プレミアムパック' },
];

// コインパッケージIDからコイン数を引くマップ
export const COIN_PACKAGE_MAP: Record<string, CoinPackage> = Object.fromEntries(
  COIN_PACKAGES.map((p) => [p.id, p])
);

// レシート1回あたりのコイン消費
export const COIN_PER_SCAN = 10;

// OCR枠パッケージ定義
// プランの1回あたりコスト基準（スタンダード: 5円/回）より少し高めに設定
// コイン最安: 0.9円/コイン → 5円/回 ÷ 0.9 = 5.56コイン/回
// 繰越可能で柔軟性があるため、プランよりやや割高に設定
export const OCR_QUOTA_PACKAGES: OCRQuotaPackage[] = [
  { id: 'quota_10', quota: 10, coinCost: 90, label: '10枠パック' },
  { id: 'quota_30', quota: 30, coinCost: 250, label: '30枠パック', popular: true },
  { id: 'quota_50', quota: 50, coinCost: 400, label: '50枠パック' },
  { id: 'quota_100', quota: 100, coinCost: 750, label: '100枠パック' },
];

export const OCR_QUOTA_PACKAGE_MAP: Record<string, OCRQuotaPackage> = Object.fromEntries(
  OCR_QUOTA_PACKAGES.map((p) => [p.id, p])
);

// AI相談枠パッケージ定義
export const CHAT_QUOTA_PACKAGES: ChatQuotaPackage[] = [
  { id: 'chat_10', quota: 10, coinCost: 60, label: '10回パック' },
  { id: 'chat_30', quota: 30, coinCost: 160, label: '30回パック', popular: true },
  { id: 'chat_50', quota: 50, coinCost: 250, label: '50回パック' },
  { id: 'chat_100', quota: 100, coinCost: 450, label: '100回パック' },
];

export const CHAT_QUOTA_PACKAGE_MAP: Record<string, ChatQuotaPackage> = Object.fromEntries(
  CHAT_QUOTA_PACKAGES.map((p) => [p.id, p])
);

// ランク定義（シーズン制：3ヶ月単位、パーセンタイル基準）
export const RANKS: RankInfo[] = [
  { key: 'beginner', label: 'ビギナー', icon: '🐣', color: '#BDBDCC', minScans: 0, minPercentile: 0, description: 'はじめの一歩！', rewardCoins: 0 },
  { key: 'bronze', label: 'ブロンズ', icon: '🥉', color: '#CD7F32', minScans: 5, minPercentile: 70, description: '頑張ってる！', rewardCoins: 30 },
  { key: 'silver', label: 'シルバー', icon: '🥈', color: '#C0C0C0', minScans: 15, minPercentile: 50, description: '節約の達人！', rewardCoins: 100 },
  { key: 'gold', label: 'ゴールド', icon: '🥇', color: '#FFD700', minScans: 30, minPercentile: 30, description: '家計管理マスター！', rewardCoins: 250 },
  { key: 'platinum', label: 'プラチナ', icon: '💎', color: '#7C4DFF', minScans: 60, minPercentile: 10, description: 'トップクラス！', rewardCoins: 500 },
  { key: 'diamond', label: 'ダイヤモンド', icon: '👑', color: '#FF6B9D', minScans: 100, minPercentile: 3, description: '伝説の節約王！', rewardCoins: 800 },
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

/**
 * パーセンタイルからランクを取得（シーズン制用）
 * @param percentile 上位○%（100が最上位、0が最下位）
 */
export function getRankFromPercentile(percentile: number): RankInfo {
  // パーセンタイルが高い方が上位なので、降順にチェック
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (percentile >= RANKS[i].minPercentile) {
      return RANKS[i];
    }
  }
  return RANKS[0]; // フォールバック
}

/**
 * スキャン数とランキングからパーセンタイルを計算
 * @param myRanking 自分の順位（1位、2位、...）
 * @param totalUsers 総ユーザー数
 */
export function calculatePercentile(myRanking: number, totalUsers: number): number {
  if (totalUsers === 0) return 0;
  // 上位○%を計算（100が最上位）
  return Math.round(((totalUsers - myRanking + 1) / totalUsers) * 100);
}

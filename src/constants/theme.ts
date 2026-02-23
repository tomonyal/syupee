// シュッピー カラーテーマ（黄色のひよこ）
export const COLORS = {
  // プライマリ（黄色・ひよこ）
  primary: '#FDD835',
  primaryLight: '#FFEB3B',
  primaryDark: '#F9A825',

  // セカンダリ（緑色・グラフ）
  secondary: '#4CAF50',
  secondaryLight: '#66BB6A',
  secondaryDark: '#388E3C',

  // アクセント（オレンジ・くちばし）
  accent: '#FF9800',
  accentLight: '#FFB74D',
  accentDark: '#F57C00',

  // 背景（クリーム色）
  background: '#FFF9E6',
  surface: '#FFFFFF',
  surfaceLight: '#FFFEF7',
  card: '#FFFFFF',

  // テキスト
  text: '#3E2723',
  textSecondary: '#6D4C41',
  textLight: '#8D6E63',
  textOnPrimary: '#3E2723',

  // ステータス
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // その他
  border: '#F5E6D3',
  divider: '#FAF3E8',
  shadow: 'rgba(253, 216, 53, 0.2)',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // グラデーション
  gradientStart: '#FDD835',
  gradientEnd: '#FFEB3B',

  // タブバー
  tabActive: '#FDD835',
  tabInactive: '#BCAAA4',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  title: 28,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 8,
  },
};

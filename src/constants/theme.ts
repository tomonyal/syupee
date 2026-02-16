// ポップ・カラフルなテーマ
export const COLORS = {
  // プライマリ
  primary: '#FF6B9D',
  primaryLight: '#FF8FB8',
  primaryDark: '#E5537F',

  // セカンダリ
  secondary: '#7C4DFF',
  secondaryLight: '#A27FFF',
  secondaryDark: '#5C35CC',

  // アクセント
  accent: '#FFD93D',
  accentLight: '#FFE566',
  accentDark: '#E6C235',

  // 背景
  background: '#FFF5F7',
  surface: '#FFFFFF',
  surfaceLight: '#FFFAF0',
  card: '#FFFFFF',

  // テキスト
  text: '#2D2D3A',
  textSecondary: '#6B6B80',
  textLight: '#9999AD',
  textOnPrimary: '#FFFFFF',

  // ステータス
  success: '#51CF66',
  warning: '#FFA94D',
  error: '#FF6B6B',
  info: '#339AF0',

  // その他
  border: '#F0E6EB',
  divider: '#F5ECF0',
  shadow: 'rgba(255, 107, 157, 0.15)',
  overlay: 'rgba(0, 0, 0, 0.5)',

  // グラデーション
  gradientStart: '#FF6B9D',
  gradientEnd: '#FF8FB8',

  // タブバー
  tabActive: '#FF6B9D',
  tabInactive: '#BDBDCC',
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

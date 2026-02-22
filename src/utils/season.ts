/**
 * シーズン計算ユーティリティ
 * 1シーズン = 3ヶ月（四半期）
 */

export type Season = {
  year: number;
  quarter: 1 | 2 | 3 | 4; // Q1: 1-3月, Q2: 4-6月, Q3: 7-9月, Q4: 10-12月
  seasonId: string; // "2026-Q1" 形式
  startMonth: number; // 1-12
  endMonth: number; // 1-12
};

/**
 * 日付からシーズンを取得
 */
export function getSeasonFromDate(date: Date = new Date()): Season {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-11 -> 1-12

  let quarter: 1 | 2 | 3 | 4;
  let startMonth: number;
  let endMonth: number;

  if (month >= 1 && month <= 3) {
    quarter = 1;
    startMonth = 1;
    endMonth = 3;
  } else if (month >= 4 && month <= 6) {
    quarter = 2;
    startMonth = 4;
    endMonth = 6;
  } else if (month >= 7 && month <= 9) {
    quarter = 3;
    startMonth = 7;
    endMonth = 9;
  } else {
    quarter = 4;
    startMonth = 10;
    endMonth = 12;
  }

  return {
    year,
    quarter,
    seasonId: `${year}-Q${quarter}`,
    startMonth,
    endMonth,
  };
}

/**
 * 現在のシーズンを取得
 */
export function getCurrentSeason(): Season {
  return getSeasonFromDate(new Date());
}

/**
 * 前シーズンを取得
 */
export function getPreviousSeason(season?: Season): Season {
  const current = season || getCurrentSeason();
  
  if (current.quarter === 1) {
    // Q1の前はQ4（前年）
    return {
      year: current.year - 1,
      quarter: 4,
      seasonId: `${current.year - 1}-Q4`,
      startMonth: 10,
      endMonth: 12,
    };
  } else {
    // Q2, Q3, Q4の場合
    const quarter = (current.quarter - 1) as 1 | 2 | 3 | 4;
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      year: current.year,
      quarter,
      seasonId: `${current.year}-Q${quarter}`,
      startMonth,
      endMonth,
    };
  }
}

/**
 * シーズンの開始日を取得
 */
export function getSeasonStartDate(season: Season): Date {
  return new Date(season.year, season.startMonth - 1, 1);
}

/**
 * シーズンの終了日を取得
 */
export function getSeasonEndDate(season: Season): Date {
  // 月末を取得（翌月の0日 = 今月末）
  return new Date(season.year, season.endMonth, 0, 23, 59, 59);
}

/**
 * シーズンの表示名を取得
 */
export function getSeasonDisplayName(season: Season): string {
  const quarters = {
    1: '春シーズン',
    2: '夏シーズン',
    3: '秋シーズン',
    4: '冬シーズン',
  };
  return `${season.year}年 ${quarters[season.quarter]} (${season.startMonth}-${season.endMonth}月)`;
}

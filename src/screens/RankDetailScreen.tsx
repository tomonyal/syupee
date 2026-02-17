import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCoinStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, RANKS, getNextRankInfo } from '../constants';

export default function RankDetailScreen() {
  const { monthlyScans, rank, loadCoinData } = useCoinStore();

  useFocusEffect(
    useCallback(() => {
      loadCoinData();
    }, [])
  );

  const { nextRank, remaining } = getNextRankInfo(monthlyScans);
  const progress = nextRank
    ? (monthlyScans - rank.minScans) / (nextRank.minScans - rank.minScans)
    : 1;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* 現在のランクカード */}
      <View style={[styles.currentRankCard, { borderColor: rank.color }]}>
        <Text style={styles.currentRankIcon}>{rank.icon}</Text>
        <Text style={[styles.currentRankLabel, { color: rank.color }]}>{rank.label}</Text>
        <Text style={styles.currentRankDesc}>{rank.description}</Text>
        <View style={styles.scanCountRow}>
          <Text style={styles.scanCountLabel}>今月のスキャン数</Text>
          <Text style={styles.scanCountValue}>{monthlyScans}回</Text>
        </View>

        {/* プログレスバー */}
        {nextRank && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: rank.color },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              次のランク「{nextRank.label}{nextRank.icon}」まで あと{remaining}回
            </Text>
          </View>
        )}
        {!nextRank && (
          <Text style={styles.maxRankText}>🎊 最高ランク達成！</Text>
        )}
      </View>

      {/* 全ランク一覧 */}
      <Text style={styles.sectionTitle}>🏅 ランク一覧</Text>
      <View style={styles.rankList}>
        {RANKS.map((r, idx) => {
          const isCurrent = r.key === rank.key;
          const isAchieved = monthlyScans >= r.minScans;
          return (
            <View
              key={r.key}
              style={[
                styles.rankItem,
                isCurrent && { borderColor: r.color, borderWidth: 2, backgroundColor: '#FFF8FA' },
                !isAchieved && styles.rankItemLocked,
              ]}
            >
              <View style={styles.rankItemLeft}>
                <Text style={[styles.rankItemIcon, !isAchieved && styles.lockedIcon]}>
                  {isAchieved ? r.icon : '🔒'}
                </Text>
                <View>
                  <Text style={[styles.rankItemLabel, isCurrent && { color: r.color }]}>
                    {r.label}
                  </Text>
                  <Text style={styles.rankItemDesc}>{r.description}</Text>
                </View>
              </View>
              <Text style={styles.rankItemMin}>
                {r.minScans}回〜
              </Text>
            </View>
          );
        })}
      </View>

      {/* ルール説明 */}
      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>📖 ランクのルール</Text>
        <Text style={styles.rulesText}>
          ・ランクは毎月の読み込み回数で決まります{'\n'}
          ・月が変わるとスキャン数はリセットされます{'\n'}
          ・たくさんレシートを読み込んでランクアップ！
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  currentRankCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 3,
  },
  currentRankIcon: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  currentRankLabel: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '900',
  },
  currentRankDesc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  scanCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  scanCountLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  scanCountValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '900',
    color: COLORS.text,
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  progressText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  maxRankText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  rankList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  rankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankItemLocked: {
    opacity: 0.5,
  },
  rankItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  rankItemIcon: {
    fontSize: 32,
  },
  lockedIcon: {
    fontSize: 24,
  },
  rankItemLabel: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  rankItemDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rankItemMin: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  rulesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  rulesTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  rulesText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});

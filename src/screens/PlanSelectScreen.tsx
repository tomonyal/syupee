import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Button } from '../components';
import { useAuthStore } from '../store';
import { updatePlan } from '../services/firebase';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, PLANS } from '../constants';
import { SubscriptionPlan } from '../types';

export default function PlanSelectScreen() {
  const navigation = useNavigation();
  const { user, refresh } = useAuthStore();

  const handleSelectPlan = async (planKey: SubscriptionPlan) => {
    if (!user) return;
    if (user.plan === planKey) {
      Alert.alert('現在のプラン', 'すでにこのプランをご利用中です');
      return;
    }

    Alert.alert(
      'プラン変更',
      `プランを変更しますか？\n※実際の決済は公式ストアのサブスクリプションで処理されます。`,
      [
        { text: 'キャンセル' },
        {
          text: '変更する',
          onPress: async () => {
            try {
              await updatePlan(user.uid, planKey);
              await refresh();
              Alert.alert('完了', 'プランを変更しました 🎉');
              navigation.goBack();
            } catch (error) {
              Alert.alert('エラー', 'プラン変更に失敗しました');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>あなたにぴったりのプランを選ぼう ✨</Text>
      <Text style={styles.subheader}>🎁 すべてのプラン初月無料！</Text>

      {PLANS.map((plan, idx) => {
        const isCurrentPlan = user?.plan === plan.key;
        const isRecommended = plan.key === 'standard';

        return (
          <TouchableOpacity
            key={plan.key}
            onPress={() => handleSelectPlan(plan.key)}
            activeOpacity={0.8}
          >
            <View style={[styles.planCard, isCurrentPlan && styles.currentPlanCard]}>
              {isRecommended && (
                <LinearGradient
                  colors={[COLORS.primary, COLORS.secondary]}
                  style={styles.recommendBadge}
                >
                  <Text style={styles.recommendText}>おすすめ</Text>
                </LinearGradient>
              )}

              {isCurrentPlan && (
                <View style={styles.currentBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.currentBadgeText}>利用中</Text>
                </View>
              )}

              <Text style={styles.planName}>{plan.label}</Text>

              <View style={styles.priceRow}>
                <Text style={styles.yen}>¥</Text>
                <Text style={styles.price}>{plan.price.toLocaleString()}</Text>
                <Text style={styles.period}>/月</Text>
              </View>

              <Text style={styles.planDescription}>{plan.description}</Text>

              <View style={styles.features}>
                <FeatureRow
                  icon="camera"
                  label={`OCR撮影 ${plan.ocrLimit}枚/月`}
                />
                <FeatureRow
                  icon="chatbubbles"
                  label={`AI相談 ${plan.chatLimit}回/月`}
                />
                <FeatureRow icon="download" label="CSVエクスポート" />
                <FeatureRow icon="push" label="CSVインポート" />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.note}>
        ※ 決済はApp Store / Google Playのサブスクリプションで処理されます。{'\n'}
        ※ 無料期間中にキャンセルすれば料金は発生しません。
      </Text>
    </ScrollView>
  );
}

function FeatureRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon as any} size={16} color={COLORS.success} />
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
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
  header: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subheader: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
    overflow: 'hidden',
  },
  currentPlanCard: {
    borderColor: COLORS.primary,
  },
  recommendBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderBottomLeftRadius: BORDER_RADIUS.md,
  },
  recommendText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  currentBadgeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
  planName: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.sm,
  },
  yen: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.primary,
  },
  price: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.primary,
  },
  period: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  planDescription: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  features: {
    gap: SPACING.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  note: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.md,
  },
});

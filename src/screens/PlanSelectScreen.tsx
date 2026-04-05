import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, Button } from '../components';
import { useAuthStore, usePurchaseStore } from '../store';
import { isPurchasesAvailable, PlanOffering } from '../services/purchases';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, PLANS } from '../constants';
import { SubscriptionPlan } from '../types';

export default function PlanSelectScreen() {
  const navigation = useNavigation();
  const { user, refresh, setUser } = useAuthStore();
  const { planOfferings, isPurchasing, isLoadingOfferings, buyPlanSubscription, restore, loadOfferings } = usePurchaseStore();
  const [iapAvailable, setIapAvailable] = React.useState(isPurchasesAvailable());

  useFocusEffect(
    useCallback(() => {
      const checkAndLoad = async () => {
        for (let i = 0; i < 10; i++) {
          if (isPurchasesAvailable()) {
            setIapAvailable(true);
            loadOfferings();
            return;
          }
          await new Promise(r => setTimeout(r, 500));
        }
        setIapAvailable(isPurchasesAvailable());
        if (isPurchasesAvailable()) {
          loadOfferings();
        }
      };
      checkAndLoad();
    }, [])
  );

  // IAP経由のプラン購入
  const handleIAPPurchase = async (planKey: SubscriptionPlan, offering: PlanOffering) => {
    if (!user) return;
    if (user.plan === planKey) {
      Alert.alert('現在のプラン', 'すでにこのプランをご利用中です');
      return;
    }

    const plan = PLANS.find((p) => p.key === planKey);
    Alert.alert(
      'プラン変更',
      `${plan?.label || planKey}プラン（${offering.localizedPrice}/月）に変更しますか？`,
      [
        { text: 'キャンセル' },
        {
          text: '変更する',
          onPress: async () => {
            const success = await buyPlanSubscription(offering);
            if (success) {
              Alert.alert('完了', 'プランを変更しました 🎉');
              navigation.goBack();
            } else {
              const errMsg = usePurchaseStore.getState().error;
              if (errMsg) {
                Alert.alert('購入エラー', errMsg);
              }
            }
          },
        },
      ]
    );
  };

  // 開発用フォールバック削除済み - 本番ではStripe経由のみ

  // 購入復元
  const handleRestore = async () => {
    await restore();
    Alert.alert('完了', '購入情報を復元しました');
  };

  // オファリングからプランの価格を取得
  const getPriceForPlan = (planKey: SubscriptionPlan): string | null => {
    const offering = planOfferings.find((o) => o.planKey === planKey);
    return offering?.localizedPrice || null;
  };

  const handleSelectPlan = (planKey: SubscriptionPlan) => {
    if (!iapAvailable) {
      Alert.alert('準備中', '決済サービスの初期化中です。しばらくお待ちください。');
      return;
    }
    const offering = planOfferings.find((o) => o.planKey === planKey);
    if (offering) {
      handleIAPPurchase(planKey, offering);
    } else {
      Alert.alert('エラー', 'プラン情報の取得に失敗しました。画面を開き直してください。');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.header}>あなたにぴったりのプランを選ぼう ✨</Text>
      <Text style={styles.subheader}>🎁 すべてのプラン初月無料！</Text>

      {isPurchasing && (
        <View style={styles.purchasingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.purchasingText}>決済処理中...</Text>
        </View>
      )}

      {PLANS.filter((plan) => plan.key !== 'free').map((plan, idx) => {
        const isCurrentPlan = user?.plan === plan.key;
        const isRecommended = plan.key === 'standard';
        const iapPrice = getPriceForPlan(plan.key);

        return (
          <TouchableOpacity
            key={plan.key}
            onPress={() => handleSelectPlan(plan.key)}
            activeOpacity={0.8}
            disabled={isPurchasing}
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
                {iapPrice ? (
                  <>
                    <Text style={styles.price}>{iapPrice}</Text>
                    <Text style={styles.period}>/月</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.yen}>¥</Text>
                    <Text style={styles.price}>{plan.price.toLocaleString()}</Text>
                    <Text style={styles.period}>/月</Text>
                  </>
                )}
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

      {/* 購入復元ボタン */}
      <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
        <Ionicons name="refresh" size={16} color={COLORS.primary} />
        <Text style={styles.restoreText}>購入を復元する</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        ※ 決済はStripeのセキュアな決済システムで処理されます。{'\n'}
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
  purchasingOverlay: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  purchasingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  restoreText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

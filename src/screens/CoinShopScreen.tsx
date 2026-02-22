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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCoinStore, usePurchaseStore } from '../store';
import { isPurchasesAvailable } from '../services/purchases';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, COIN_PACKAGES, COIN_PACKAGE_MAP, COIN_PER_SCAN, OCR_QUOTA_PACKAGES, OCR_QUOTA_PACKAGE_MAP } from '../constants';
import { CoinPackage, OCRQuotaPackage } from '../types';
import { CoinOffering } from '../services/purchases';

export default function CoinShopScreen() {
  const { balance, ocrQuotaBalance, transactions, isLoading, purchase, purchaseQuota, loadCoinData } = useCoinStore();
  const { coinOfferings, isLoadingOfferings, isPurchasing, buyCoinPackage, loadOfferings } = usePurchaseStore();
  const navigation = useNavigation();
  const iapAvailable = isPurchasesAvailable();

  useFocusEffect(
    useCallback(() => {
      loadCoinData();
      if (iapAvailable) {
        loadOfferings();
      }
    }, [])
  );

  // IAP経由の購入
  const handleIAPPurchase = async (offering: CoinOffering) => {
    const pkg = COIN_PACKAGE_MAP[offering.packageId];
    if (!pkg) return;

    Alert.alert(
      'コイン購入',
      `${pkg.label}\n${pkg.coins}コインを${offering.localizedPrice}で購入しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            const success = await buyCoinPackage(offering);
            if (success) {
              Alert.alert('購入完了！', `${pkg.coins}コインを獲得しました 🎉`);
            }
          },
        },
      ]
    );
  };

  // 開発用フォールバック（IAP未設定時）
  const handleDevPurchase = (pkg: CoinPackage) => {
    Alert.alert(
      'コイン購入（開発モード）',
      `${pkg.label}\n${pkg.coins}コインを¥${pkg.price}で購入しますか？\n\n⚠️ 実際の決済は行われません`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            try {
              await purchase(pkg.coins, pkg.price);
              Alert.alert('購入完了！', `${pkg.coins}コインを獲得しました 🎉`);
            } catch (e: any) {
              Alert.alert('エラー', e.message);
            }
          },
        },
      ]
    );
  };

  // OCR枠の購入
  const handleQuotaPurchase = (pkg: OCRQuotaPackage) => {
    Alert.alert(
      'OCR枠を購入',
      `${pkg.label}\n${pkg.quota}枠を${pkg.coinCost}コインで購入しますか？\n\n残高: ${balance}コイン\n翌月以降も繰り越されます`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            try {
              await purchaseQuota(pkg.quota, pkg.coinCost);
              Alert.alert('購入完了！', `${pkg.quota}枠を獲得しました 📸\n翌月以降も使えます`);
            } catch (e: any) {
              Alert.alert('エラー', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* 残高カード */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>コイン残高</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.coinIcon}>🪙</Text>
          <Text style={styles.balanceAmount}>{balance.toLocaleString()}</Text>
          <Text style={styles.balanceUnit}>コイン</Text>
        </View>
        <Text style={styles.balanceHint}>
          レシート読み込み 1回 = {COIN_PER_SCAN}コイン
        </Text>
        <View style={styles.quotaRow}>
          <Text style={styles.quotaLabel}>📸 OCR枠残高</Text>
          <Text style={styles.quotaAmount}>{ocrQuotaBalance}枠</Text>
        </View>
        <Text style={styles.quotaHint}>プラン枠を超えたら自動で消費（翌月繰越）</Text>
      </View>

      {/* コインパッケージ */}
      <Text style={styles.sectionTitle}>🛒 コインを購入</Text>

      {isPurchasing && (
        <View style={styles.purchasingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.purchasingText}>決済処理中...</Text>
        </View>
      )}

      <View style={styles.packagesContainer}>
        {iapAvailable && coinOfferings.length > 0
          ? /* IAP商品を表示 */
            coinOfferings.map((offering) => {
              const pkg = COIN_PACKAGE_MAP[offering.packageId];
              if (!pkg) return null;
              return (
                <TouchableOpacity
                  key={offering.packageId}
                  style={[styles.packageCard, pkg.popular && styles.packageCardPopular]}
                  onPress={() => handleIAPPurchase(offering)}
                  activeOpacity={0.7}
                  disabled={isPurchasing}
                >
                  {pkg.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>人気</Text>
                    </View>
                  )}
                  <Text style={styles.packageLabel}>{pkg.label}</Text>
                  <View style={styles.packageCoinRow}>
                    <Text style={styles.packageCoinIcon}>🪙</Text>
                    <Text style={styles.packageCoins}>{pkg.coins}</Text>
                  </View>
                  <Text style={styles.packagePrice}>{offering.localizedPrice}</Text>
                  <Text style={styles.packageUnit}>
                    (1コイン ¥{(offering.price / pkg.coins).toFixed(1)})
                  </Text>
                </TouchableOpacity>
              );
            })
          : /* 開発用フォールバック */
            COIN_PACKAGES.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[styles.packageCard, pkg.popular && styles.packageCardPopular]}
                onPress={() => handleDevPurchase(pkg)}
                activeOpacity={0.7}
              >
                {pkg.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>人気</Text>
                  </View>
                )}
                <Text style={styles.packageLabel}>{pkg.label}</Text>
                <View style={styles.packageCoinRow}>
                  <Text style={styles.packageCoinIcon}>🪙</Text>
                  <Text style={styles.packageCoins}>{pkg.coins}</Text>
                </View>
                <Text style={styles.packagePrice}>¥{pkg.price}</Text>
                <Text style={styles.packageUnit}>
                  (1コイン ¥{(pkg.price / pkg.coins).toFixed(1)})
                </Text>
              </TouchableOpacity>
            ))
        }
      </View>

      {!iapAvailable && (
        <Text style={styles.devNote}>
          ⚠️ 開発モード: 実際の決済は行われません
        </Text>
      )}

      {/* 取引履歴 */}
      <Text style={styles.sectionTitle}>📋 取引履歴</Text>
      {transactions.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyText}>まだ取引がありません</Text>
        </View>
      ) : (
        <View style={styles.historyContainer}>
          {transactions.slice(0, 20).map((tx) => (
            <View key={tx.id} style={styles.historyItem}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyIcon}>
                  {tx.type === 'purchase' ? '💰' : tx.type === 'bonus' ? '🎁' : '📷'}
                </Text>
                <View>
                  <Text style={styles.historyDesc}>{tx.description}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(tx.createdAt).toLocaleDateString('ja-JP')}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.historyAmount,
                  tx.amount > 0 ? styles.amountPlus : styles.amountMinus,
                ]}
              >
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </Text>
            </View>
          ))}
        </View>
      )}
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
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  balanceLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  coinIcon: {
    fontSize: 32,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#F57C00',
  },
  balanceUnit: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  balanceHint: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  quotaLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  quotaAmount: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  quotaHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  packagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  packageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    width: '48%' as any,
    flexGrow: 1,
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
  },
  packageCardPopular: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF0F5',
  },
  quotaPackageCard: {
    borderColor: '#9C27B0',
    backgroundColor: '#F3E5F5',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: -5,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  popularText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  packageLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  packageCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  packageCoinIcon: {
    fontSize: 20,
  },
  packageCoins: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '900',
    color: COLORS.text,
  },
  quotaCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  quotaCoinIcon: {
    fontSize: 16,
  },
  quotaCost: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: '#9C27B0',
  },
  packagePrice: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.xs,
  },
  packageUnit: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
  },
  emptyHistory: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
  },
  historyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  historyIcon: {
    fontSize: 24,
  },
  historyDesc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  historyDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  historyAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
  },
  amountPlus: {
    color: COLORS.success,
  },
  amountMinus: {
    color: COLORS.error,
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
  devNote: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.warning || '#FF9800',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
});

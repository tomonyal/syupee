import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCoinStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, OCR_QUOTA_PACKAGES, CHAT_QUOTA_PACKAGES } from '../constants';
import { OCRQuotaPackage, ChatQuotaPackage } from '../types';

export default function QuotaPurchaseScreen() {
  const { balance, ocrQuotaBalance, chatQuotaBalance, isLoading, purchaseQuota, purchaseChatQuota, loadCoinData } = useCoinStore();
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      loadCoinData();
    }, [])
  );

  // OCR枠の購入
  const handleOCRPurchase = (pkg: OCRQuotaPackage) => {
    // コイン不足チェック
    if (balance < pkg.coinCost) {
      Alert.alert(
        'コインが不足しています',
        `この購入には${pkg.coinCost}コイン必要です。\n現在の残高: ${balance}コイン\n\nコインを追加購入しますか？`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: 'コイン購入',
            onPress: () => navigation.navigate('CoinShop' as never),
          },
        ]
      );
      return;
    }

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

  // AI相談枠の購入
  const handleChatPurchase = (pkg: ChatQuotaPackage) => {
    // コイン不足チェック
    if (balance < pkg.coinCost) {
      Alert.alert(
        'コインが不足しています',
        `この購入には${pkg.coinCost}コイン必要です。\n現在の残高: ${balance}コイン\n\nコインを追加購入しますか？`,
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: 'コイン購入',
            onPress: () => navigation.navigate('CoinShop' as never),
          },
        ]
      );
      return;
    }

    Alert.alert(
      'AI相談枠を購入',
      `${pkg.label}\n${pkg.quota}回分を${pkg.coinCost}コインで購入しますか？\n\n残高: ${balance}コイン\n翌月以降も繰り越されます`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '購入する',
          onPress: async () => {
            try {
              await purchaseChatQuota(pkg.quota, pkg.coinCost);
              Alert.alert('購入完了！', `${pkg.quota}回分を獲得しました 💬\n翌月以降も使えます`);
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
        <View style={styles.quotaInfoRow}>
          <View style={styles.quotaInfo}>
            <Text style={styles.quotaInfoLabel}>📸 OCR枠残高</Text>
            <Text style={styles.quotaInfoAmount}>{ocrQuotaBalance}枠</Text>
          </View>
          <View style={styles.quotaInfo}>
            <Text style={styles.quotaInfoLabel}>💬 AI相談枠残高</Text>
            <Text style={styles.quotaInfoAmount}>{chatQuotaBalance}回</Text>
          </View>
        </View>
        <Text style={styles.balanceHint}>
          プラン枠を超えたら自動で消費（翌月繰越）
        </Text>
        
        {/* コイン購入への誘導 */}
        <TouchableOpacity
          style={styles.buyCoinButton}
          onPress={() => navigation.navigate('CoinShop' as never)}
        >
          <Ionicons name="cart" size={18} color="#FFFFFF" />
          <Text style={styles.buyCoinButtonText}>コインを購入</Text>
        </TouchableOpacity>
      </View>

      {/* OCR枠パッケージ */}
      <Text style={styles.sectionTitle}>📸 OCR撮影枠を追加購入</Text>
      <Text style={styles.sectionDescription}>
        プラン枠を超えても、追加購入した枠で撮影できます
      </Text>
      <View style={styles.packagesContainer}>
        {OCR_QUOTA_PACKAGES.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.packageCard, pkg.popular && styles.packageCardPopular]}
            onPress={() => handleOCRPurchase(pkg)}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            {pkg.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>人気</Text>
              </View>
            )}
            <Text style={styles.packageLabel}>{pkg.label}</Text>
            <View style={styles.packageQuotaRow}>
              <Text style={styles.packageQuotaIcon}>📸</Text>
              <Text style={styles.packageQuota}>{pkg.quota}枠</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costCoinIcon}>🪙</Text>
              <Text style={styles.costAmount}>{pkg.coinCost}</Text>
            </View>
            <Text style={styles.packageUnit}>
              (1枠 {(pkg.coinCost / pkg.quota).toFixed(1)}コイン)
            </Text>
            {balance < pkg.coinCost && (
              <Text style={styles.insufficientText}>コイン不足</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* AI相談枠パッケージ */}
      <Text style={styles.sectionTitle}>💬 AI相談枠を追加購入</Text>
      <Text style={styles.sectionDescription}>
        プラン枠を超えても、追加購入した枠で相談できます
      </Text>
      <View style={styles.packagesContainer}>
        {CHAT_QUOTA_PACKAGES.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={[styles.packageCard, styles.chatPackageCard, pkg.popular && styles.packageCardPopular]}
            onPress={() => handleChatPurchase(pkg)}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            {pkg.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>人気</Text>
              </View>
            )}
            <Text style={styles.packageLabel}>{pkg.label}</Text>
            <View style={styles.packageQuotaRow}>
              <Text style={styles.packageQuotaIcon}>💬</Text>
              <Text style={styles.packageQuota}>{pkg.quota}回</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costCoinIcon}>🪙</Text>
              <Text style={styles.costAmount}>{pkg.coinCost}</Text>
            </View>
            <Text style={styles.packageUnit}>
              (1回 {(pkg.coinCost / pkg.quota).toFixed(1)}コイン)
            </Text>
            {balance < pkg.coinCost && (
              <Text style={styles.insufficientText}>コイン不足</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.noteCard}>
        <Ionicons name="information-circle" size={20} color={COLORS.info} />
        <Text style={styles.noteText}>
          追加購入した枠は翌月以降も繰り越されます。プラン枠を使い切った後に自動的に消費されます。
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
  },
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  coinIcon: {
    fontSize: 36,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.text,
  },
  balanceUnit: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  quotaInfoRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  quotaInfo: {
    alignItems: 'center',
  },
  quotaInfoLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  quotaInfoAmount: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    fontWeight: '700',
  },
  balanceHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  buyCoinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  buyCoinButtonText: {
    fontSize: FONT_SIZE.sm,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  packagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  packageCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    width: '47%',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  chatPackageCard: {
    borderColor: '#CE93D8',
  },
  packageCardPopular: {
    borderColor: COLORS.accent,
    borderWidth: 3,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  popularText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.text,
    fontWeight: '700',
  },
  packageLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  packageQuotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  packageQuotaIcon: {
    fontSize: 24,
  },
  packageQuota: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  costCoinIcon: {
    fontSize: 16,
  },
  costAmount: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  packageUnit: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  insufficientText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  noteText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

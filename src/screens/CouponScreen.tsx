import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from '../components';
import { useAuthStore, useCoinStore } from '../store';
import { getCurrentFirebaseUser } from '../services/firebase';
import { STRIPE_CONFIG } from '../services/config';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';

const API_BASE_URL = STRIPE_CONFIG.apiBaseUrl;

async function getAuthToken(): Promise<string | null> {
  try {
    const user = getCurrentFirebaseUser();
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export default function CouponScreen() {
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const { refresh } = useAuthStore();
  const { loadCoinData } = useCoinStore();
  const navigation = useNavigation();

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('エラー', 'クーポンコードを入力してください');
      return;
    }

    setIsRedeeming(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        Alert.alert('エラー', '認証されていません。ログインし直してください。');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/redeemCoupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('エラー', data.error || 'クーポンの引き換えに失敗しました');
        return;
      }

      // 成功 → 残高をリロード
      await refresh();
      await loadCoinData();
      setCode('');

      Alert.alert(
        'クーポン適用！ 🎉',
        `${data.coinAmount}コインを獲得しました！\n枠の追加購入に使えます。`,
        [
          { text: '閉じる', style: 'cancel', onPress: () => navigation.goBack() },
          { text: '枠を購入する', onPress: () => (navigation as any).replace('QuotaPurchase') },
        ]
      );
    } catch (error: any) {
      Alert.alert('エラー', error.message || '通信エラーが発生しました');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Card style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="ticket-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>クーポンコードを入力</Text>
          <Text style={styles.description}>
            クーポンコードをお持ちの方は、下のフィールドに入力してコインを受け取れます。
          </Text>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="例: SYUPEE2026"
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={30}
            editable={!isRedeeming}
          />

          <Button
            title={isRedeeming ? '引き換え中...' : 'コインを受け取る'}
            onPress={handleRedeem}
            disabled={isRedeeming || code.trim().length === 0}
            fullWidth
            icon={<Ionicons name="gift-outline" size={20} color={COLORS.textOnPrimary} />}
          />
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  card: {
    padding: SPACING.xl,
    alignItems: 'center' as const,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
  },
});

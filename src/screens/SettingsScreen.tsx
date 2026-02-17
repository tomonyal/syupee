import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Card, Button } from '../components';
import { useAuthStore, usePurchaseStore } from '../store';
import { exportCSV, importCSV } from '../utils/csv';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, PLAN_MAP } from '../constants';

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const { restore } = usePurchaseStore();
  const navigation = useNavigation<any>();
  const planInfo = user ? PLAN_MAP[user.plan] : null;

  const handleRestore = async () => {
    await restore();
    Alert.alert('完了', '購入情報を復元しました');
  };

  const handleSignOut = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert('エラー', 'ログアウトに失敗しました');
          }
        },
      },
    ]);
  };

  const handleExportCSV = async () => {
    try {
      await exportCSV();
      Alert.alert('エクスポート完了', 'CSVファイルを保存しました 📄');
    } catch (error: any) {
      Alert.alert('エラー', error.message || 'エクスポートに失敗しました');
    }
  };

  const handleImportCSV = async () => {
    try {
      const count = await importCSV();
      Alert.alert(
        'インポート完了',
        `${count}件の支出データを取り込みました 🎉`
      );
    } catch (error: any) {
      Alert.alert('エラー', error.message || 'インポートに失敗しました');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      {/* プロフィールカード */}
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          {user?.photoURL ? (
            <Image
              source={{ uri: user.photoURL }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={32} color={COLORS.textLight} />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>
              {user?.displayName || 'ユーザー'}
            </Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        {/* 現在のプラン */}
        <View style={styles.planBadge}>
          <Ionicons name="star" size={16} color={COLORS.accent} />
          <Text style={styles.planText}>
            {planInfo?.label || 'ライト'}プラン
          </Text>
          <Text style={styles.planPrice}>
            ¥{planInfo?.price.toLocaleString() || '200'}/月
          </Text>
        </View>
      </Card>

      {/* プラン管理 */}
      <SettingsSection title="💎 プラン管理">
        <SettingsRow
          icon="diamond-outline"
          label="プランを変更"
          onPress={() => navigation.navigate('PlanSelect')}
          showArrow
        />
        <SettingsRow
          icon="refresh-outline"
          label="購入を復元"
          subtitle="機種変更後にサブスクを復元"
          onPress={handleRestore}
          showArrow
        />
      </SettingsSection>

      {/* 予算設定 */}
      <SettingsSection title="💰 予算管理">
        <SettingsRow
          icon="wallet-outline"
          label="予算を設定"
          subtitle="月ごとの予算をまとめて or カテゴリ別に設定"
          onPress={() => navigation.navigate('BudgetSetting')}
          showArrow
        />
      </SettingsSection>

      {/* コイン＆ランク */}
      <SettingsSection title="🪙 コイン＆ランク">
        <SettingsRow
          icon="cart-outline"
          label="コインショップ"
          subtitle="コインを購入してレシートを読み込もう"
          onPress={() => navigation.navigate('CoinShop')}
          showArrow
        />
        <SettingsRow
          icon="trophy-outline"
          label="ランク"
          subtitle="今月のスキャン数でランクアップ！"
          onPress={() => navigation.navigate('RankDetail')}
          showArrow
        />
      </SettingsSection>

      {/* データ管理 */}
      <SettingsSection title="📂 データ管理">
        <SettingsRow
          icon="download-outline"
          label="CSVエクスポート"
          subtitle="支出データをCSVファイルに保存"
          onPress={handleExportCSV}
          showArrow
        />
        <SettingsRow
          icon="push-outline"
          label="CSVインポート"
          subtitle="CSVファイルから支出データを取り込み"
          onPress={handleImportCSV}
          showArrow
        />
      </SettingsSection>

      {/* アプリ情報 */}
      <SettingsSection title="ℹ️ アプリ情報">
        <SettingsRow
          icon="information-circle-outline"
          label="バージョン"
          value="1.0.0"
        />
        <SettingsRow
          icon="document-text-outline"
          label="利用規約"
          onPress={() => {}}
          showArrow
        />
        <SettingsRow
          icon="shield-outline"
          label="プライバシーポリシー"
          onPress={() => {}}
          showArrow
        />
      </SettingsSection>

      {/* ログアウト */}
      <View style={styles.logoutSection}>
        <Button
          title="ログアウト"
          onPress={handleSignOut}
          variant="outline"
          fullWidth
          icon={<Ionicons name="log-out-outline" size={20} color={COLORS.primary} />}
        />
      </View>
    </ScrollView>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card noPadding style={styles.sectionCard}>
        {children}
      </Card>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  subtitle,
  value,
  onPress,
  showArrow,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={styles.settingsRow} onPress={onPress}>
      <Ionicons
        name={icon as any}
        size={22}
        color={COLORS.primary}
        style={styles.rowIcon}
      />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {value && <Text style={styles.rowValue}>{value}</Text>}
      {showArrow && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={COLORS.textLight}
        />
      )}
    </Wrapper>
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
  profileCard: {
    marginBottom: SPACING.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: SPACING.md,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  email: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.accent + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  planText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  planPrice: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  sectionCard: {
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  rowIcon: {
    marginRight: SPACING.md,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  rowValue: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
  logoutSection: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
});

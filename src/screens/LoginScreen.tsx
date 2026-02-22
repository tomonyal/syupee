import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components';
import { useAuthStore } from '../store';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS } from '../constants';

export default function LoginScreen() {
  const { signIn, isLoading } = useAuthStore();

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error: any) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.primary, COLORS.secondary]}
      style={styles.gradient}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        {/* ロゴエリア */}
        <View style={styles.logoArea}>
          <View style={styles.iconCircle}>
            <Ionicons name="receipt" size={60} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>シュッピくん</Text>
          <Text style={styles.tagline}>撮るだけで節約相談 📷✨</Text>
        </View>

        {/* 特徴説明 */}
        <View style={styles.features}>
          <FeatureItem
            icon="camera-outline"
            text="レシートを撮るだけで自動記録"
          />
          <FeatureItem
            icon="chatbubble-ellipses-outline"
            text="AIが節約アドバイスしてくれる"
          />
          <FeatureItem
            icon="shield-checkmark-outline"
            text="銀行連携不要でプライバシー安心"
          />
        </View>

        {/* ログインボタン */}
        <View style={styles.loginArea}>
          <Button
            title="Googleアカウントで始める"
            onPress={handleSignIn}
            loading={isLoading}
            variant="outline"
            size="large"
            fullWidth
            icon={<Ionicons name="logo-google" size={20} color={COLORS.textOnPrimary} />}
            style={styles.googleButton}
            textStyle={styles.googleButtonText}
          />
          <Text style={styles.trialText}>🎁 初月無料でお試し！</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon as any} size={24} color={COLORS.textOnPrimary} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
  },
  logoArea: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  appName: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: FONT_SIZE.lg,
    color: 'rgba(255,255,255,0.95)',
    marginTop: SPACING.sm,
  },
  features: {
    gap: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textOnPrimary,
    fontWeight: '600',
    flex: 1,
  },
  loginArea: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.8)',
  },
  googleButtonText: {
    color: COLORS.textOnPrimary,
  },
  trialText: {
    fontSize: FONT_SIZE.md,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
});

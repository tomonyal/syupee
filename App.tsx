import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { AppNavigator } from './src/navigation';
import { initFirebase, onAuthChange, refreshUser } from './src/services/firebase';
import { initializePurchases, loginPurchaseUser } from './src/services/purchases';
import { STRIPE_CONFIG } from './src/services/config';
import { getDatabase } from './src/database';
import { useAuthStore } from './src/store';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from './src/constants';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const { setUser } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      // Firebase初期化
      initFirebase();

      // DB初期化
      await getDatabase();

      // 認証状態の監視
      const unsubscribe = onAuthChange(async (firebaseUser) => {
        try {
          if (firebaseUser) {
            const user = await refreshUser(firebaseUser.uid);
            setUser(user);

            // Stripe初期化（ユーザーが認証済みの場合）
            await initializePurchases(firebaseUser.uid);
            await loginPurchaseUser(firebaseUser.uid);
          } else {
            setUser(null);
          }
        } catch (e) {
          console.warn('[App] onAuthChange callback error:', e);
        } finally {
          setIsInitializing(false);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('App initialization error:', error);
      setIsInitializing(false);
    }
  };

  if (isInitializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StripeProvider
        publishableKey={STRIPE_CONFIG.publishableKey}
        merchantIdentifier={STRIPE_CONFIG.merchantIdentifier}
        urlScheme="syupee"
      >
        <StatusBar style="light" />
        <AppNavigator />
      </StripeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});

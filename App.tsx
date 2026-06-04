import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { initFirebase, onAuthChange, refreshUser, getFirebaseStatus } from './src/services/firebase';
import { initializePurchases, loginPurchaseUser } from './src/services/purchases';
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
      
      // Firebase状態をログに出力（デバッグ用）
      const fbStatus = getFirebaseStatus();
      console.log('[App] Firebase Status:', JSON.stringify(fbStatus, null, 2));
      if (!fbStatus.isAvailable) {
        console.error('[App] ⚠️ Firebase is NOT available! Init error:', fbStatus.initError);
      }

      // DB初期化
      await getDatabase();

      // 認証状態の監視
      const unsubscribe = onAuthChange(async (firebaseUser) => {
        try {
          if (firebaseUser) {
            const user = await refreshUser(firebaseUser.uid);
            setUser(user);

            // IAP初期化（ユーザーが認証済みの場合）
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
      <StatusBar style="light" />
      <AppNavigator />
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

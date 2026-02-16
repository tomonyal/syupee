import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { initFirebase, onAuthChange, refreshUser } from './src/services/firebase';
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
        if (firebaseUser) {
          const user = await refreshUser(firebaseUser.uid);
          setUser(user);
        } else {
          setUser(null);
        }
        setIsInitializing(false);
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

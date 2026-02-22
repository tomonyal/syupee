import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, RootTabParamList } from '../types';
import { COLORS, FONT_SIZE, SPACING } from '../constants';
import { useAuthStore, useBudgetStore } from '../store';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScanScreen from '../screens/ScanScreen';
import ExpenseListScreen from '../screens/ExpenseListScreen';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import EditExpenseScreen from '../screens/EditExpenseScreen';
import PlanSelectScreen from '../screens/PlanSelectScreen';
import BudgetSettingScreen from '../screens/BudgetSettingScreen';
import CoinShopScreen from '../screens/CoinShopScreen';
import QuotaPurchaseScreen from '../screens/QuotaPurchaseScreen';
import RankDetailScreen from '../screens/RankDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const navStyles = StyleSheet.create({
  headerButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  headerButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
});

function MainTabs() {
  const { budget, loadBudget } = useBudgetStore();

  // タブがフォーカスされるたびに予算を読み込む
  useFocusEffect(
    useCallback(() => {
      loadBudget();
    }, [])
  );

  const budgetLabel = budget ? '予算を変更' : '予算を設定';

  const makeBudgetHeaderRight = (navigation: any) => () => (
    <TouchableOpacity
      style={navStyles.headerButton}
      onPress={() => navigation.navigate('BudgetSetting')}
    >
      <Text style={navStyles.headerButtonText}>{budgetLabel}</Text>
    </TouchableOpacity>
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Scan':
              iconName = focused ? 'camera' : 'camera-outline';
              break;
            case 'Expenses':
              iconName = focused ? 'list' : 'list-outline';
              break;
            case 'Chat':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.tabActive,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 24,
          paddingTop: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: FONT_SIZE.xs,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.textOnPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: FONT_SIZE.lg,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'ホーム',
          headerTitle: 'シュッピくん',
          headerRight: makeBudgetHeaderRight(navigation),
        })}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{ title: '撮影', headerTitle: 'レシート撮影' }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpenseListScreen}
        options={({ navigation }) => ({
          title: '支出一覧',
          headerTitle: '支出一覧',
          headerRight: makeBudgetHeaderRight(navigation),
        })}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={({ navigation }) => ({
          title: 'AI相談',
          headerTitle: 'AI相談',
          headerRight: makeBudgetHeaderRight(navigation),
        })}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '設定', headerTitle: '設定' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textOnPrimary,
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{ title: '支出詳細' }}
            />
            <Stack.Screen
              name="EditExpense"
              component={EditExpenseScreen}
              options={{ title: '支出編集' }}
            />
            <Stack.Screen
              name="PlanSelect"
              component={PlanSelectScreen}
              options={{ title: 'プラン選択' }}
            />
            <Stack.Screen
              name="BudgetSetting"
              component={BudgetSettingScreen}
              options={{ title: '予算設定' }}
            />
            <Stack.Screen
              name="CoinShop"
              component={CoinShopScreen}
              options={{ title: 'コインショップ' }}
            />
            <Stack.Screen
              name="QuotaPurchase"
              component={QuotaPurchaseScreen}
              options={{ title: '枠を追加購入' }}
            />
            {/* ランクシステム：開発中のため一旦非表示
            <Stack.Screen
              name="RankDetail"
              component={RankDetailScreen}
              options={{ title: 'ランク' }}
            />
            */}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

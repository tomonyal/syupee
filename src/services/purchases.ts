import {
  initPaymentSheet,
  presentPaymentSheet,
} from '@stripe/stripe-react-native';
import { SubscriptionPlan } from '../types';
import { STRIPE_CONFIG } from './config';
import { isFirebaseAvailable, getCurrentFirebaseUser } from './firebase';

// ============================
// Stripe設定
// ============================

// Firebase Cloud Functions のベースURL
const API_BASE_URL = STRIPE_CONFIG.apiBaseUrl;

// コインパッケージの Stripe Price ID
export const COIN_PRICE_IDS: Record<string, string> = {
  coin_50: 'price_1TCqQeQLTQl0iplLMyV8xhCe',
  coin_100: 'price_1TCqJjQLTQl0iplL4CFMA4HE',
  coin_300: 'price_1TCqROQLTQl0iplLQSqTVRct',
  coin_500: 'price_1TCqRhQLTQl0iplLeYOnxGkx',
  coin_1000: 'price_1TCqS6QLTQl0iplLiJuXs9Y6',
};

// サブスクリプションの Stripe Price ID
export const PLAN_PRICE_IDS: Record<SubscriptionPlan, string> = {
  free: '',
  light: 'price_1TCqIMQLTQl0iplLj5prm8Rl',
  standard: 'price_1TCqSnQLTQl0iplLhjqYqJJl',
  premium: 'price_1TCqT1QLTQl0iplLROTdHl5b',
};

let isInitialized = false;

// ============================
// 初期化
// ============================

/**
 * Stripe SDK初期化フラグをセット
 * 実際の初期化はApp.tsxのStripeProviderで行う
 */
export async function initializePurchases(userId?: string): Promise<void> {
  if (isInitialized) return;

  const publishableKey = STRIPE_CONFIG.publishableKey;

  if (!publishableKey) {
    console.warn('[Stripe] Publishable Keyが設定されていません。課金機能は無効です。');
    return;
  }

  isInitialized = true;
  console.log('[Stripe] 初期化完了');
}

/**
 * Stripeが初期化済みかどうか
 */
export function isPurchasesAvailable(): boolean {
  return isInitialized;
}

// ============================
// Firebase認証トークン取得
// ============================

async function getAuthToken(): Promise<string | null> {
  try {
    const user = getCurrentFirebaseUser();
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

// ============================
// APIリクエスト
// ============================

async function apiRequest(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('認証されていません。ログインしてください。');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `APIエラー (${response.status})`);
  }

  return response.json();
}

// ============================
// ユーザー管理
// ============================

/**
 * ログインユーザーをStripeに紐づける（Stripe Customerの作成/取得）
 */
export async function loginPurchaseUser(userId: string): Promise<void> {
  if (!isInitialized || !isFirebaseAvailable) return;
  try {
    await apiRequest('/stripeCreateOrGetCustomer', { userId });
    console.log('[Stripe] ユーザー紐づけ完了');
  } catch (error) {
    console.error('[Stripe] ユーザー紐づけエラー:', error);
  }
}

/**
 * ログアウト時の処理
 */
export async function logoutPurchaseUser(): Promise<void> {
  console.log('[Stripe] ログアウト処理完了');
}

// ============================
// オファリング型定義
// ============================

export interface CoinOffering {
  packageId: string;
  priceId: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
}

export interface PlanOffering {
  planKey: SubscriptionPlan;
  priceId: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
}

// ============================
// オファリング取得
// ============================

/**
 * 利用可能な商品情報をサーバーから取得
 */
export async function getOfferings(): Promise<{
  coinPackages: CoinOffering[];
  planPackages: PlanOffering[];
} | null> {
  if (!isInitialized || !isFirebaseAvailable) return null;

  try {
    const result = await apiRequest('/stripeGetProducts', {});

    const coinPackages: CoinOffering[] = (result.coinProducts || []).map((p: any) => ({
      packageId: p.packageId,
      priceId: p.priceId,
      localizedPrice: p.localizedPrice,
      price: p.price,
      currencyCode: p.currencyCode || 'JPY',
    }));

    const planPackages: PlanOffering[] = (result.planProducts || []).map((p: any) => ({
      planKey: p.planKey as SubscriptionPlan,
      priceId: p.priceId,
      localizedPrice: p.localizedPrice,
      price: p.price,
      currencyCode: p.currencyCode || 'JPY',
    }));

    return { coinPackages, planPackages };
  } catch (error) {
    console.error('[Stripe] 商品情報取得エラー:', error);
    return null;
  }
}

// ============================
// コイン購入（一回払い）
// ============================

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  plan?: SubscriptionPlan;
}

/**
 * コインパッケージを購入（Stripe PaymentSheet使用）
 */
export async function purchaseCoinPackage(offering: CoinOffering): Promise<PurchaseResult> {
  if (!isInitialized || !isFirebaseAvailable) {
    return { success: false, error: 'Payment service is not initialized' };
  }

  try {
    // 1. サーバーからPaymentIntentを作成
    const { paymentIntent, ephemeralKey, customer } = await apiRequest(
      '/stripeCreateCoinPaymentIntent',
      {
        priceId: offering.priceId,
        packageId: offering.packageId,
      }
    );

    // 2. PaymentSheetを初期化
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: paymentIntent,
      customerEphemeralKeySecret: ephemeralKey,
      customerId: customer,
      merchantDisplayName: 'Syupee',
      style: 'automatic',
      returnURL: 'syupee://stripe-redirect',
    });

    if (initError) {
      return { success: false, error: initError.message };
    }

    // 3. PaymentSheetを表示
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, cancelled: true };
      }
      return { success: false, error: presentError.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || '購入に失敗しました' };
  }
}

// ============================
// サブスクリプション購入
// ============================

/**
 * プランサブスクリプションを購入（Stripe PaymentSheet使用）
 */
export async function purchasePlanSubscription(offering: PlanOffering): Promise<PurchaseResult> {
  if (!isInitialized || !isFirebaseAvailable) {
    return { success: false, error: 'Payment service is not initialized' };
  }

  try {
    // 1. サーバーからSubscriptionを作成
    const { paymentIntent, ephemeralKey, customer, activated } = await apiRequest(
      '/stripeCreateSubscription',
      {
        priceId: offering.priceId,
        planKey: offering.planKey,
      }
    );

    // サーバー側で即時アクティブ化された場合（無料プラン等）
    if (activated) {
      return { success: true, plan: offering.planKey };
    }

    // 2. PaymentSheetを初期化
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: paymentIntent,
      customerEphemeralKeySecret: ephemeralKey,
      customerId: customer,
      merchantDisplayName: 'Syupee',
      style: 'automatic',
      returnURL: 'syupee://stripe-redirect',
    });

    if (initError) {
      return { success: false, error: initError.message };
    }

    // 3. PaymentSheetを表示
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      if (presentError.code === 'Canceled') {
        return { success: false, cancelled: true };
      }
      return { success: false, error: presentError.message };
    }

    return { success: true, plan: offering.planKey };
  } catch (error: any) {
    return { success: false, error: error.message || 'プラン購入に失敗しました' };
  }
}

// ============================
// サブスクリプション状態確認
// ============================

/**
 * 現在のサブスクリプションプランを取得
 */
export async function getCurrentPlan(): Promise<SubscriptionPlan> {
  if (!isInitialized || !isFirebaseAvailable) return 'free';

  try {
    const result = await apiRequest('/stripeGetCurrentPlan', {});
    return (result.plan as SubscriptionPlan) || 'free';
  } catch (error) {
    console.error('[Stripe] プラン確認エラー:', error);
    return 'free';
  }
}

/**
 * PurchaseResultからプランを取得
 */
export function getPlanFromPurchaseResult(result: PurchaseResult): SubscriptionPlan {
  return result.plan || 'free';
}

// ============================
// サブスクリプション管理
// ============================

/**
 * サブスクリプションをキャンセル
 */
export async function cancelSubscription(): Promise<boolean> {
  if (!isInitialized || !isFirebaseAvailable) return false;

  try {
    await apiRequest('/stripeCancelSubscription', {});
    return true;
  } catch (error) {
    console.error('[Stripe] サブスクキャンセルエラー:', error);
    return false;
  }
}

/**
 * Stripe Customer PortalのURLを取得
 */
export async function getCustomerPortalUrl(): Promise<string | null> {
  if (!isInitialized || !isFirebaseAvailable) return null;

  try {
    const result = await apiRequest('/stripeCreatePortalSession', {});
    return result.url || null;
  } catch (error) {
    console.error('[Stripe] ポータルURL取得エラー:', error);
    return null;
  }
}

// ============================
// 購入復元
// ============================

/**
 * 購入を復元する（サーバー側でサブスク状態を確認）
 */
export async function restorePurchases(): Promise<{
  plan: SubscriptionPlan;
}> {
  if (!isInitialized || !isFirebaseAvailable) {
    return { plan: 'free' };
  }

  try {
    const result = await apiRequest('/stripeRestorePurchases', {});
    const plan = (result.plan as SubscriptionPlan) || 'free';
    return { plan };
  } catch (error) {
    console.error('[Stripe] 復元エラー:', error);
    return { plan: 'free' };
  }
}

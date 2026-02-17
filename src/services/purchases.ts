import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { SubscriptionPlan } from '../types';

// ============================
// RevenueCat設定
// ============================

// RevenueCat APIキー（.env に設定してください）
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '';

// RevenueCat上のEntitlement ID（ダッシュボードで設定）
const ENTITLEMENT_LIGHT = 'plan_light';
const ENTITLEMENT_STANDARD = 'plan_standard';
const ENTITLEMENT_PREMIUM = 'plan_premium';

// コインパッケージのRevenueCat Product ID
export const COIN_PRODUCT_IDS: Record<string, string> = {
  coin_50: 'syupee_coin_50',
  coin_100: 'syupee_coin_100',
  coin_300: 'syupee_coin_300',
  coin_500: 'syupee_coin_500',
  coin_1000: 'syupee_coin_1000',
};

// サブスクリプションのRevenueCat Product ID
export const PLAN_PRODUCT_IDS: Record<SubscriptionPlan, string> = {
  light: 'syupee_plan_light',
  standard: 'syupee_plan_standard',
  premium: 'syupee_plan_premium',
};

let isInitialized = false;

// ============================
// 初期化
// ============================

/**
 * RevenueCat SDKを初期化
 * アプリ起動時に1回だけ呼ぶ
 */
export async function initializePurchases(userId?: string): Promise<void> {
  if (isInitialized) return;

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

  if (!apiKey) {
    console.warn('[Purchases] RevenueCat APIキーが設定されていません。決済機能は無効です。');
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);

    if (userId) {
      await Purchases.configure({ apiKey, appUserID: userId });
    } else {
      await Purchases.configure({ apiKey });
    }

    isInitialized = true;
    console.log('[Purchases] RevenueCat初期化完了');
  } catch (error) {
    console.error('[Purchases] 初期化エラー:', error);
  }
}

/**
 * RevenueCatが初期化済みかどうか
 */
export function isPurchasesAvailable(): boolean {
  return isInitialized;
}

// ============================
// ユーザー識別
// ============================

/**
 * ログインユーザーをRevenueCatに紐づける
 */
export async function loginPurchaseUser(userId: string): Promise<void> {
  if (!isInitialized) return;
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('[Purchases] ユーザーログインエラー:', error);
  }
}

/**
 * ログアウト時にRevenueCatの匿名ユーザーに戻す
 */
export async function logoutPurchaseUser(): Promise<void> {
  if (!isInitialized) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('[Purchases] ログアウトエラー:', error);
  }
}

// ============================
// オファリング取得
// ============================

export interface CoinOffering {
  packageId: string;
  productId: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
  rcPackage: PurchasesPackage;
}

export interface PlanOffering {
  planKey: SubscriptionPlan;
  productId: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
  rcPackage: PurchasesPackage;
}

/**
 * 利用可能なオファリングを取得
 */
export async function getOfferings(): Promise<{
  coinPackages: CoinOffering[];
  planPackages: PlanOffering[];
} | null> {
  if (!isInitialized) return null;

  try {
    const offerings = await Purchases.getOfferings();

    const coinPackages: CoinOffering[] = [];
    const planPackages: PlanOffering[] = [];

    // コインオファリング（"coins" offering identifier）
    const coinOffering = offerings.all['coins'];
    if (coinOffering) {
      for (const pkg of coinOffering.availablePackages) {
        const product = pkg.product;
        // パッケージIDからコインIDを逆引き
        const coinId = Object.entries(COIN_PRODUCT_IDS).find(
          ([, pid]) => pid === product.identifier
        )?.[0];

        if (coinId) {
          coinPackages.push({
            packageId: coinId,
            productId: product.identifier,
            localizedPrice: product.priceString,
            price: product.price,
            currencyCode: product.currencyCode,
            rcPackage: pkg,
          });
        }
      }
    }

    // サブスクリプションオファリング（"plans" offering identifier）
    const planOffering = offerings.all['plans'];
    if (planOffering) {
      for (const pkg of planOffering.availablePackages) {
        const product = pkg.product;
        const planEntry = Object.entries(PLAN_PRODUCT_IDS).find(
          ([, pid]) => pid === product.identifier
        );

        if (planEntry) {
          planPackages.push({
            planKey: planEntry[0] as SubscriptionPlan,
            productId: product.identifier,
            localizedPrice: product.priceString,
            price: product.price,
            currencyCode: product.currencyCode,
            rcPackage: pkg,
          });
        }
      }
    }

    return { coinPackages, planPackages };
  } catch (error) {
    console.error('[Purchases] オファリング取得エラー:', error);
    return null;
  }
}

// ============================
// コイン購入（消耗品）
// ============================

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  customerInfo?: CustomerInfo;
}

/**
 * コインパッケージを購入
 */
export async function purchaseCoinPackage(offering: CoinOffering): Promise<PurchaseResult> {
  if (!isInitialized) {
    return { success: false, error: '決済サービスが初期化されていません' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(offering.rcPackage);
    return { success: true, customerInfo };
  } catch (error: any) {
    if (error?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { success: false, cancelled: true };
    }
    return { success: false, error: error.message || '購入に失敗しました' };
  }
}

// ============================
// サブスクリプション購入
// ============================

/**
 * プランサブスクリプションを購入
 */
export async function purchasePlanSubscription(offering: PlanOffering): Promise<PurchaseResult> {
  if (!isInitialized) {
    return { success: false, error: '決済サービスが初期化されていません' };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(offering.rcPackage);
    return { success: true, customerInfo };
  } catch (error: any) {
    if (error?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { success: false, cancelled: true };
    }
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
  if (!isInitialized) return 'light';

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlements = customerInfo.entitlements.active;

    if (entitlements[ENTITLEMENT_PREMIUM]?.isActive) return 'premium';
    if (entitlements[ENTITLEMENT_STANDARD]?.isActive) return 'standard';
    if (entitlements[ENTITLEMENT_LIGHT]?.isActive) return 'light';

    return 'light';
  } catch (error) {
    console.error('[Purchases] プラン確認エラー:', error);
    return 'light';
  }
}

/**
 * CustomerInfoからプランを判定
 */
export function getPlanFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionPlan {
  const entitlements = customerInfo.entitlements.active;

  if (entitlements[ENTITLEMENT_PREMIUM]?.isActive) return 'premium';
  if (entitlements[ENTITLEMENT_STANDARD]?.isActive) return 'standard';
  if (entitlements[ENTITLEMENT_LIGHT]?.isActive) return 'light';

  return 'light';
}

// ============================
// 購入復元
// ============================

/**
 * 購入を復元する（機種変更時など）
 */
export async function restorePurchases(): Promise<{
  plan: SubscriptionPlan;
  customerInfo: CustomerInfo | null;
}> {
  if (!isInitialized) {
    return { plan: 'light', customerInfo: null };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const plan = getPlanFromCustomerInfo(customerInfo);
    return { plan, customerInfo };
  } catch (error) {
    console.error('[Purchases] 復元エラー:', error);
    return { plan: 'light', customerInfo: null };
  }
}

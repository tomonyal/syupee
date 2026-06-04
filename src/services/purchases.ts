import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  clearTransactionIOS,
  type Purchase,
  type PurchaseError,
  type Product,
} from 'react-native-iap';
import { SubscriptionPlan } from '../types';
import { isFirebaseAvailable, getCurrentFirebaseUser } from './firebase';

// ============================
// App Store Connect Product IDs
// ============================

// サブスクリプション Product ID
export const PLAN_PRODUCT_IDS: Record<Exclude<SubscriptionPlan, 'free'>, string> = {
  light: 'com.syupee.sub.light',
  standard: 'com.syupee.sub.standard',
  premium: 'com.syupee.sub.premium',
};

// コイン Consumable Product ID
export const COIN_PRODUCT_IDS: Record<string, string> = {
  coin_100: 'com.syupee.coin.100',
  coin_300: 'com.syupee.coin.300',
  coin_500: 'com.syupee.coin.500',
  coin_1000: 'com.syupee.coin.1000',
};

// Product ID → パッケージID の逆引きマップ
const PRODUCT_TO_PACKAGE: Record<string, string> = {};
for (const [pkgId, productId] of Object.entries(COIN_PRODUCT_IDS)) {
  PRODUCT_TO_PACKAGE[productId] = pkgId;
}
const PRODUCT_TO_PLAN: Record<string, SubscriptionPlan> = {};
for (const [planKey, productId] of Object.entries(PLAN_PRODUCT_IDS)) {
  PRODUCT_TO_PLAN[productId] = planKey as SubscriptionPlan;
}

// Cloud Functions ベースURL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';

let isInitialized = false;
let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

// リスナーベースの購入完了を待つためのPromiseコールバック
let pendingPurchaseResolve: ((purchase: Purchase) => void) | null = null;
let pendingPurchaseReject: ((error: any) => void) | null = null;

// ============================
// 初期化
// ============================

export async function initializePurchases(userId?: string): Promise<void> {
  if (isInitialized) return;

  try {
    const result = await initConnection();
    isInitialized = true;
    console.log('[IAP]','IAP初期化', `接続完了: ${JSON.stringify(result).substring(0, 100)}`);

    // 未完了トランザクションをクリア（前回の購入が未完了だと次回がブロックされる）
    try {
      await clearTransactionIOS();
      console.log('[IAP]','ClearTx', '未完了トランザクションをクリアしました');
    } catch (e: any) {
      console.warn('[IAP] clearTransactionIOS:', e?.message);
    }

    // 購入成功リスナー
    purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
      console.log('[IAP]','Listener: Purchase受信', `productId=${purchase.productId}\ntxId=${purchase.transactionId}\nkeys=${Object.keys(purchase).join(',')}`);
      if (pendingPurchaseResolve) {
        pendingPurchaseResolve(purchase);
        pendingPurchaseResolve = null;
        pendingPurchaseReject = null;
      }
    });

    // 購入エラーリスナー
    purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
      console.log('[IAP]','Listener: Purchaseエラー', `code=${error.code}\nmessage=${error.message}`);
      if (pendingPurchaseReject) {
        pendingPurchaseReject(error);
        pendingPurchaseResolve = null;
        pendingPurchaseReject = null;
      }
    });

  } catch (error: any) {
    console.log('[IAP]','IAP初期化エラー', `${error?.message || error}`);
  }
}

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
// APIリクエスト (Cloud Functions)
// ============================

async function apiRequest(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const token = await getAuthToken();
  console.log('[IAP]','apiRequest', `endpoint: ${endpoint}\ntoken: ${token ? `${token.substring(0, 20)}...` : 'NULL!'}\nAPI_BASE_URL: ${API_BASE_URL || '(empty)'}`);
  if (!token) {
    throw new Error('認証されていません。ログインしてください。');
  }
  if (!API_BASE_URL) {
    throw new Error('API_BASE_URLが設定されていません');
  }

  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  console.log('[IAP]','API Response', `status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.log('[IAP]','API Error', `status: ${response.status}\n${errorText.substring(0, 300)}`);
    let errorMessage = `APIエラー (${response.status})`;
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  const json = await response.json();
  console.log('[IAP]','API Success', JSON.stringify(json).substring(0, 300));
  return json;
}

// ============================
// ユーザー管理
// ============================

export async function loginPurchaseUser(userId: string): Promise<void> {
  // IAP ではユーザー紐づけ不要（Apple ID ベース）
  console.log('[IAP] ユーザーログイン:', userId);
}

export async function logoutPurchaseUser(): Promise<void> {
  console.log('[IAP] ユーザーログアウト');
}

// ============================
// オファリング型定義
// ============================

export interface CoinOffering {
  packageId: string;
  productId: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
}

export interface PlanOffering {
  planKey: SubscriptionPlan;
  productId: string;
  localizedPrice: string;
  price: number;
  currencyCode: string;
}

// ============================
// オファリング取得
// ============================

export async function getOfferings(): Promise<{
  coinPackages: CoinOffering[];
  planPackages: PlanOffering[];
} | null> {
  if (!isInitialized) {
    console.warn('[IAP] getOfferings: not initialized');
    return null;
  }

  try {
    const coinProductIds = Object.values(COIN_PRODUCT_IDS);
    const planProductIds = Object.values(PLAN_PRODUCT_IDS);
    console.log('[IAP] Requesting coins:', JSON.stringify(coinProductIds));
    console.log('[IAP] Requesting subs:', JSON.stringify(planProductIds));

    const [coinProducts, planProducts] = await Promise.all([
      fetchProducts({ skus: coinProductIds }),
      fetchProducts({ skus: planProductIds, type: 'subs' }),
    ]);

    console.log('[IAP] coinProducts count:', coinProducts.length);
    console.log('[IAP] planProducts count:', planProducts.length);

    const coinPackages: CoinOffering[] = coinProducts.map((p: Product) => ({
      packageId: PRODUCT_TO_PACKAGE[p.id] || p.id,
      productId: p.id,
      localizedPrice: p.displayPrice || `¥${p.price}`,
      price: p.price || 0,
      currencyCode: p.currency || 'JPY',
    }));

    const planPackages: PlanOffering[] = planProducts.map((p: Product) => ({
      planKey: PRODUCT_TO_PLAN[p.id] || ('free' as SubscriptionPlan),
      productId: p.id,
      localizedPrice: p.displayPrice || `¥${p.price}`,
      price: p.price || 0,
      currencyCode: p.currency || 'JPY',
    }));

    console.log('[IAP] Final: coins=', coinPackages.length, 'plans=', planPackages.length);
    return { coinPackages, planPackages };
  } catch (error: any) {
    console.error('[IAP] 商品情報取得エラー:', error?.message || error, JSON.stringify(error));
    return null;
  }
}

// ============================
// コイン購入（Consumable）
// ============================

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  plan?: SubscriptionPlan;
}

/**
 * リスナー経由で購入結果を待つ。
 * requestPurchase はStoreKit 2ではPurchaseオブジェクトを返さないため、
 * purchaseUpdatedListener からの通知をPromiseで受け取る。
 */
function waitForPurchase(timeoutMs: number = 120000): Promise<Purchase> {
  return new Promise<Purchase>((resolve, reject) => {
    pendingPurchaseResolve = resolve;
    pendingPurchaseReject = reject;

    // タイムアウト
    setTimeout(() => {
      if (pendingPurchaseResolve) {
        pendingPurchaseResolve = null;
        pendingPurchaseReject = null;
        reject({ code: 'E_USER_CANCELLED', message: '購入がキャンセルまたはタイムアウトしました' });
      }
    }, timeoutMs);
  });
}

export async function purchaseCoinPackage(offering: CoinOffering): Promise<PurchaseResult> {
  if (!isInitialized) {
    return { success: false, error: 'IAP is not initialized' };
  }

  let p: Purchase | null = null;
  try {
    console.log('[IAP]','Coin購入開始', `productId: ${offering.productId}`);

    // リスナーからの購入結果を待つPromiseを先にセット
    const purchasePromise = waitForPurchase();

    // 購入リクエスト開始（StoreKit 2では結果を直接返さない）
    requestPurchase({
      request: { apple: { sku: offering.productId } },
      type: 'in-app',
    }).catch((err: any) => {
      // キャンセルはリスナー経由ではなくここで来る場合がある
      if (pendingPurchaseReject) {
        pendingPurchaseReject(err);
        pendingPurchaseResolve = null;
        pendingPurchaseReject = null;
      }
    });

    // リスナーからの購入結果を待つ
    p = await purchasePromise;
    console.log('[IAP]','Purchase完了', `productId=${p.productId}\ntxId=${p.transactionId}`);

    // StoreKit 2: トランザクション情報をサーバーに送信（getReceiptIOSは使わない — Appleサインイン要求が発生するため）
    const transactionId = p.transactionId;
    console.log('[IAP]','Transaction', `id: ${transactionId}`);

    // サーバーで検証
    const result = await apiRequest('/validateAppleReceipt', {
      transactionId,
      productId: p.productId,
      packageId: offering.packageId,
      type: 'coin',
    });

    if (result?.success) {
      // 検証成功時のみトランザクションを完了（失敗時はリトライ可能にする）
      try {
        await finishTransaction({ purchase: p, isConsumable: true });
        console.log('[IAP]','FinishTx', '完了');
      } catch (finishErr: any) {
        console.log('[IAP]','FinishTxエラー', finishErr?.message || '');
      }
      return { success: true };
    } else {
      return { success: false, error: result?.message || '検証に失敗しました' };
    }
  } catch (error: any) {
    console.log('[IAP]','Coin購入エラー', `message: ${error?.message}\ncode: ${error?.code}`);
    // サーバー検証失敗時はfinishTransactionを呼ばない（リトライ可能にする）
    if (error?.code === 'E_USER_CANCELLED') {
      return { success: false, cancelled: true };
    }
    return { success: false, error: error.message || '購入に失敗しました' };
  }
}

// ============================
// サブスクリプション購入
// ============================

export async function purchasePlanSubscription(offering: PlanOffering): Promise<PurchaseResult> {
  if (!isInitialized) {
    return { success: false, error: 'IAP is not initialized' };
  }

  let p: Purchase | null = null;
  try {
    console.log('[IAP]','Plan購入開始', `productId: ${offering.productId}\nplanKey: ${offering.planKey}`);

    // リスナーからの購入結果を待つPromiseを先にセット
    const purchasePromise = waitForPurchase();

    // 購入リクエスト開始
    requestPurchase({
      request: { apple: { sku: offering.productId } },
      type: 'subs',
    }).catch((err: any) => {
      if (pendingPurchaseReject) {
        pendingPurchaseReject(err);
        pendingPurchaseResolve = null;
        pendingPurchaseReject = null;
      }
    });

    // リスナーからの購入結果を待つ
    p = await purchasePromise;
    console.log('[IAP]','Purchase完了', `productId=${p.productId}\ntxId=${p.transactionId}`);

    // StoreKit 2: トランザクション情報をサーバーに送信
    const transactionId = p.transactionId;
    console.log('[IAP]','Transaction', `id: ${transactionId}`);

    // サーバーで検証
    const result = await apiRequest('/validateAppleReceipt', {
      transactionId,
      productId: p.productId,
      planKey: offering.planKey,
      type: 'subscription',
    });

    if (result?.success) {
      // 検証成功時のみトランザクションを完了
      try {
        await finishTransaction({ purchase: p, isConsumable: false });
        console.log('[IAP]','FinishTx', '完了');
      } catch (finishErr: any) {
        console.log('[IAP]','FinishTxエラー', finishErr?.message || '');
      }
      return { success: true, plan: offering.planKey };
    } else {
      return { success: false, error: result?.message || '検証に失敗しました' };
    }
  } catch (error: any) {
    console.log('[IAP]','Plan購入エラー', `message: ${error?.message}\ncode: ${error?.code}`);
    // サーバー検証失敗時はfinishTransactionを呼ばない（リトライ可能にする）
    if (error?.code === 'E_USER_CANCELLED') {
      return { success: false, cancelled: true };
    }
    return { success: false, error: error.message || 'プラン購入に失敗しました' };
  }
}

// ============================
// サブスクリプション状態確認
// ============================

export async function getCurrentPlan(): Promise<SubscriptionPlan> {
  if (!isInitialized || !isFirebaseAvailable) return 'free';

  try {
    // Apple側のアクティブなサブスクリプションを確認
    const purchases = await getAvailablePurchases();
    let activePlan: SubscriptionPlan = 'free';
    let activeTransactionId = '';
    let activeProductId = '';

    for (const p of purchases) {
      const plan = PRODUCT_TO_PLAN[p.productId];
      if (plan) {
        activePlan = plan;
        activeTransactionId = p.transactionId || '';
        activeProductId = p.productId;
        break;
      }
    }

    // サーバーにApple側の状態を同期（バックグラウンドで実行）
    apiRequest('/getCurrentPlan', {
      applePlan: activePlan,
      transactionId: activeTransactionId,
      productId: activeProductId,
    }).catch(() => {});

    return activePlan;
  } catch (error) {
    console.error('[IAP] プラン確認エラー:', error);
    // Apple側の確認に失敗した場合はサーバーのプランをフォールバック
    try {
      const result = await apiRequest('/getCurrentPlan', {});
      return (result.plan as SubscriptionPlan) || 'free';
    } catch {
      return 'free';
    }
  }
}

export function getPlanFromPurchaseResult(result: PurchaseResult): SubscriptionPlan {
  return result.plan || 'free';
}

// ============================
// サブスクリプション管理
// ============================

/**
 * サブスクリプションのキャンセル
 * iOSではアプリ内からキャンセルできないため、設定画面に誘導
 */
export async function cancelSubscription(): Promise<boolean> {
  // iOS ではアプリ内から直接解約できない → サブスク管理画面を開く
  const { Linking } = require('react-native');
  await Linking.openURL('https://apps.apple.com/account/subscriptions');
  return true;
}

// ============================
// 購入復元
// ============================

export async function restorePurchases(): Promise<{
  plan: SubscriptionPlan;
}> {
  if (!isInitialized) {
    return { plan: 'free' };
  }

  try {
    const purchases = await getAvailablePurchases();

    // サーバーで検証（トランザクション情報を送信）
    const result = await apiRequest('/restoreApplePurchases', {
      purchases: purchases.map((p) => ({
        productId: p.productId,
        transactionId: p.transactionId,
      })),
    });

    return { plan: (result.plan as SubscriptionPlan) || 'free' };
  } catch (error) {
    console.error('[IAP] 復元エラー:', error);
    return { plan: 'free' };
  }
}

// ============================
// クリーンアップ
// ============================

export async function cleanupPurchases(): Promise<void> {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
  try {
    await endConnection();
  } catch (e) {
    // ignore
  }
  isInitialized = false;
}

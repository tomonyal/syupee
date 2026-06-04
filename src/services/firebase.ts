import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
// metro.config.js により firebase/auth → @firebase/auth/dist/rn/index.js (CJS)、
// firebase/app → CJS版 に統一解決される。これにより同じ @firebase/app
// インスタンスを共有し、auth コンポーネント登録の問題を回避する。
import {
  initializeAuth,
  getAuth as firebaseGetAuth,
  signInWithCredential,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  deleteUser as firebaseDeleteUser,
  onAuthStateChanged,
  inMemoryPersistence,
  getReactNativePersistence,
} from 'firebase/auth';

let persistenceError: string = '';

import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  increment,
  limit as firestoreLimit,
  Firestore,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, GOOGLE_CONFIG } from './config';
import { User, SubscriptionPlan, SeasonScanStats, CoinTransaction } from '../types';

// Google Sign-In を動的に読み込み（Expo Go では利用不可）
let GoogleSignin: any = null;
let statusCodes: any = null;
let isGoogleSignInAvailable = false;
try {
  const googleSignInModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignInModule.GoogleSignin;
  statusCodes = googleSignInModule.statusCodes;
  isGoogleSignInAvailable = true;
  console.log('[Auth] Google Sign-In module loaded successfully');
} catch (e) {
  console.warn('[Auth] Google Sign-In is not available:', e);
}

// Apple Authentication を動的に読み込み
let AppleAuthentication: any = null;
let isAppleSignInAvailable = false;
try {
  AppleAuthentication = require('expo-apple-authentication');
  isAppleSignInAvailable = true;
  console.log('[Auth] Apple Authentication module loaded successfully');
} catch (e) {
  console.warn('[Auth] Apple Authentication is not available:', e);
}

let Crypto: any = null;
try {
  Crypto = require('expo-crypto');
} catch (e) {
  console.warn('[Auth] expo-crypto is not available:', e);
}

let app: FirebaseApp | null = null;
let auth: any = null;
let firestore: Firestore | null = null;
export let isFirebaseAvailable = false;
let initError: string = '';

// Firebase初期化状態を取得（デバッグ用）
export function getFirebaseStatus() {
  return {
    isAvailable: isFirebaseAvailable,
    hasApp: !!app,
    hasAuth: !!auth,
    hasFirestore: !!firestore,
    initError,
  };
}

// タイムアウト付きPromise
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// 初期化
export function initFirebase(): void {
  // Firebase設定が空の場合はスキップ（開発モード）
  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    initError = 'Config missing';
    return;
  }

  try {
    // 1. Firebase App を初期化
    if (getApps().length === 0) {
      app = initializeApp(FIREBASE_CONFIG);
    } else {
      app = getApps()[0];
    }

    // 2. persistence を準備
    let persistence: any = null;
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      persistence = getReactNativePersistence(AsyncStorage);
    } catch (e: any) {
      persistenceError = e.message || String(e);
    }

    // 3. Auth を初期化
    try {
      auth = initializeAuth(app, {
        persistence: persistence || inMemoryPersistence,
      });
    } catch (authError: any) {
      // initializeAuth が既に呼ばれている場合は getAuth にフォールバック
      try {
        auth = firebaseGetAuth(app);
      } catch (getAuthError: any) {
        initError = `initAuth: ${authError.message}, getAuth: ${getAuthError.message}`;
      }
    }

    if (auth) {
      // React Native (Hermes) では experimentalForceLongPolling が
      // XMLHttpRequest HostObject の timeoutId アクセスでクラッシュするため、
      // autoDetect に切り替えて fetch ベースのトランスポートを優先する
      try {
        firestore = initializeFirestore(app, {
          experimentalAutoDetectLongPolling: true,
        });
      } catch (e) {
        // 既に初期化済みの場合は getFirestore にフォールバック
        firestore = getFirestore(app);
      }
      isFirebaseAvailable = true;
    } else if (!initError) {
      initError = 'auth is null after init';
    }

    if (isGoogleSignInAvailable && GoogleSignin) {
      // iosClientId は GoogleService-Info.plist から自動取得される
      // webClientId を指定することで idToken が返される
      GoogleSignin.configure({
        webClientId: GOOGLE_CONFIG.webClientId,
        offlineAccess: true,
      });
    }
  } catch (error: any) {
    initError = `Outer catch: ${error.message}`;
    isFirebaseAvailable = false;
  }
}

// デバッグ情報取得（TestFlight用）
export function getAuthDebugInfo(): string {
  return [
    `Firebase available: ${isFirebaseAvailable}`,
    `Google Sign-In: ${isGoogleSignInAvailable}`,
    `GoogleSignin module: ${!!GoogleSignin}`,
    `App: ${!!app} | Auth: ${!!auth} | Firestore: ${!!firestore}`,
    `Auth module loaded: true`,
    `Persistence error: ${persistenceError || 'none'}`,
    `Init error: ${initError || 'none'}`,
    `API Key: ${!!FIREBASE_CONFIG.apiKey}`,
    `Project: ${FIREBASE_CONFIG.projectId || '(empty)'}`,
    `Web Client ID: ${GOOGLE_CONFIG.webClientId ? GOOGLE_CONFIG.webClientId.substring(0, 20) + '...' : '(empty)'}`,
  ].join('\n');
}

// モック用ユーザー（Expo Go 開発用）
function createMockUser(): User {
  return {
    uid: 'dev-user-001',
    email: 'dev@example.com',
    displayName: '開発ユーザー',
    photoURL: undefined,
    plan: 'free',
    ocrUsedThisMonth: 0,
    chatUsedThisMonth: 0,
    ocrQuotaBalance: 0,
    chatQuotaBalance: 0,
    planResetDate: new Date().toISOString(),
  };
}

// Google Sign-In
export async function signInWithGoogle(): Promise<User> {
  console.log('[Auth] signInWithGoogle called. isFirebaseAvailable:', isFirebaseAvailable, 'isGoogleSignInAvailable:', isGoogleSignInAvailable, 'GoogleSignin:', !!GoogleSignin);
  
  // Firebaseが利用不可またはExpo Go ではモックユーザーを返す
  if (!isFirebaseAvailable || !isGoogleSignInAvailable || !GoogleSignin) {
    console.warn('[Auth] Using mock user. Reasons - Firebase:', !isFirebaseAvailable, 'GoogleSignIn:', !isGoogleSignInAvailable, 'Module:', !GoogleSignin);
    return createMockUser();
  }

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
  } catch (e) {
    console.log('[Auth] hasPlayServices check (expected to fail on iOS):', e);
  }
  
  const signInResult = await GoogleSignin.signIn();
  console.log('[Auth] Google Sign-In result received');
  
  // v12: signIn() returns User = { user, scopes, idToken, serverAuthCode }
  // idToken は iOS で null になることがあるため getTokens() でフォールバック
  let idToken = signInResult.idToken;

  if (!idToken) {
    console.log('[Auth] idToken null from signIn(), trying getTokens()...');
    const tokens = await GoogleSignin.getTokens();
    idToken = tokens.idToken;
  }

  if (!idToken) {
    throw new Error('Google Sign-In succeeded but could not obtain ID token');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const firebaseUser = userCredential.user;

  // Firestoreからユーザー情報を取得/作成（失敗時はFirebase Authの情報でフォールバック）
  try {
    const user = await withTimeout(getOrCreateUser(firebaseUser), 15000, 'Firestore user creation timed out');
    return user;
  } catch (e) {
    console.warn('[Auth] Firestore access failed, using auth-only user:', e);
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || undefined,
      plan: 'free',
      ocrUsedThisMonth: 0,
      chatUsedThisMonth: 0,
      ocrQuotaBalance: 0,
      chatQuotaBalance: 0,
      planResetDate: new Date().toISOString(),
    };
  }
}

// Apple Sign-In
export async function signInWithApple(): Promise<User> {
  console.log('[Auth] signInWithApple called. isFirebaseAvailable:', isFirebaseAvailable, 'isAppleSignInAvailable:', isAppleSignInAvailable);

  if (!isFirebaseAvailable) {
    console.warn('[Auth] Firebase not available, using mock user');
    return createMockUser();
  }

  if (!isAppleSignInAvailable || !AppleAuthentication) {
    throw new Error('Apple Sign-Inはこのデバイスでは利用できません');
  }

  // nonce を生成してセキュリティを強化
  const rawNonce = Crypto
    ? Crypto.randomUUID()
    : Math.random().toString(36).substring(2);
  const hashedNonce = Crypto
    ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
    : rawNonce;

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const { identityToken } = appleCredential;
  if (!identityToken) {
    throw new Error('Apple Sign-Inに失敗しました（identityTokenが取得できません）');
  }

  const provider = new OAuthProvider('apple.com');
  const oauthCredential = provider.credential({
    idToken: identityToken,
    rawNonce: rawNonce,
  });

  const userCredential = await signInWithCredential(auth, oauthCredential);
  const firebaseUser = userCredential.user;

  // Apple は初回のみ名前を返すので、displayName を設定
  if (appleCredential.fullName) {
    const givenName = appleCredential.fullName.givenName || '';
    const familyName = appleCredential.fullName.familyName || '';
    const name = `${familyName} ${givenName}`.trim();
    if (name && !firebaseUser.displayName) {
      // displayName が Firebase Auth に未設定の場合、Firestore に名前を保存
      console.log('[Auth] Setting Apple user display name:', name);
    }
  }

  try {
    const user = await withTimeout(getOrCreateUser(firebaseUser), 15000, 'Firestore user creation timed out');
    return user;
  } catch (e) {
    console.warn('[Auth] Firestore access failed, using auth-only user:', e);
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || undefined,
      plan: 'free',
      ocrUsedThisMonth: 0,
      chatUsedThisMonth: 0,
      ocrQuotaBalance: 0,
      chatQuotaBalance: 0,
      planResetDate: new Date().toISOString(),
    };
  }
}

// サインアウト
export async function signOut(): Promise<void> {
  if (isGoogleSignInAvailable && GoogleSignin) {
    await GoogleSignin.signOut();
  }
  if (isFirebaseAvailable && auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      // モック認証の場合は無視
    }
  }
}

// アカウント削除
export async function deleteAccount(uid: string): Promise<void> {
  // 1. Firebase Authユーザー削除（再認証後）— 先に実行して失敗時にデータが残るようにする
  if (isFirebaseAvailable && auth?.currentUser && auth.currentUser.uid === uid) {
    try {
      await firebaseDeleteUser(auth.currentUser);
    } catch (e: any) {
      if (e?.code === 'auth/requires-recent-login') {
        // 再認証が必要 → ログイン方法に応じて再認証
        const providerIds = auth.currentUser.providerData.map((p: any) => p.providerId);

        if (providerIds.includes('apple.com') && isAppleSignInAvailable && AppleAuthentication) {
          // Apple再認証
          const rawNonce = Crypto
            ? Crypto.randomUUID()
            : Math.random().toString(36).substring(2);
          const hashedNonce = Crypto
            ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
            : rawNonce;

          const appleCredential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
          });

          if (!appleCredential.identityToken) {
            throw new Error('Apple再認証に失敗しました');
          }

          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken: appleCredential.identityToken,
            rawNonce: rawNonce,
          });
          await reauthenticateWithCredential(auth.currentUser, credential);
          await firebaseDeleteUser(auth.currentUser);
        } else if (isGoogleSignInAvailable && GoogleSignin) {
          // Google再認証
          await GoogleSignin.signIn();
          const tokens = await GoogleSignin.getTokens();
          const credential = GoogleAuthProvider.credential(tokens.idToken);
          await reauthenticateWithCredential(auth.currentUser, credential);
          await firebaseDeleteUser(auth.currentUser);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  // 2. Firestoreのサブコレクション（coinTransactions）を削除
  if (isFirebaseAvailable && firestore) {
    const fs = firestore;
    try {
      const txQuery = query(collection(fs, 'users', uid, 'coinTransactions'));
      const txSnap = await getDocs(txQuery);
      const deletePromises: Promise<void>[] = [];
      txSnap.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
      });
      await Promise.all(deletePromises);
    } catch (e) {
      console.warn('[Account] Failed to delete subcollections:', e);
    }

    // 3. Firestoreのユーザードキュメント削除
    try {
      const userRef = doc(fs, 'users', uid);
      await deleteDoc(userRef);
    } catch (e) {
      console.warn('[Account] Failed to delete user doc:', e);
    }
  }

  // 4. Googleサインアウト
  if (isGoogleSignInAvailable && GoogleSignin) {
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // 無視
    }
  }
}

// ユーザー情報の取得/作成
async function getOrCreateUser(firebaseUser: any): Promise<User> {
  const userRef = doc(firestore, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    
    // 既存ユーザーで不足フィールドがある場合は初期化（マイグレーション対応）
    const needsUpdate = !('ocrUsedThisMonth' in data) || !('chatUsedThisMonth' in data);
    if (needsUpdate) {
      console.log('[Firebase] Initializing missing usage fields for user:', firebaseUser.uid);
      await setDoc(userRef, {
        ocrUsedThisMonth: data.ocrUsedThisMonth || 0,
        chatUsedThisMonth: data.chatUsedThisMonth || 0,
      }, { merge: true });
    }
    
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || undefined,
      plan: data.plan as SubscriptionPlan,
      ocrUsedThisMonth: data.ocrUsedThisMonth || 0,
      chatUsedThisMonth: data.chatUsedThisMonth || 0,
      ocrQuotaBalance: data.ocrQuotaBalance || 0,
      chatQuotaBalance: data.chatQuotaBalance || 0,
      planResetDate: data.planResetDate || new Date().toISOString(),
    };
  }

  // 新規ユーザー作成
  const newUser: User = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
    photoURL: firebaseUser.photoURL || undefined,
    plan: 'free',
    ocrUsedThisMonth: 0,
    chatUsedThisMonth: 0,
    ocrQuotaBalance: 0,
    chatQuotaBalance: 0,
    planResetDate: new Date().toISOString(),
  };

  await setDoc(userRef, {
    plan: newUser.plan,
    ocrUsedThisMonth: 0,
    chatUsedThisMonth: 0,
    ocrQuotaBalance: 0,
    chatQuotaBalance: 0,
    planResetDate: newUser.planResetDate,
    createdAt: new Date().toISOString(),
  });

  return newUser;
}

// 使用回数の更新（アトミックインクリメント）
export async function incrementOCRUsage(uid: string): Promise<void> {
  if (!isFirebaseAvailable || !firestore) {
    throw new Error('Firebase is not available');
  }
  try {
    const userRef = doc(firestore, 'users', uid);
    await setDoc(userRef, { ocrUsedThisMonth: increment(1) }, { merge: true });
    console.log('[Firebase] OCR usage incremented for user:', uid);
  } catch (error) {
    console.error('[Firebase] Failed to increment OCR usage:', error);
    throw error;
  }
}

export async function incrementChatUsage(uid: string): Promise<void> {
  if (!isFirebaseAvailable || !firestore) {
    throw new Error('Firebase is not available');
  }
  try {
    const userRef = doc(firestore, 'users', uid);
    await setDoc(userRef, { chatUsedThisMonth: increment(1) }, { merge: true });
    console.log('[Firebase] Chat usage incremented for user:', uid);
  } catch (error) {
    console.error('[Firebase] Failed to increment Chat usage:', error);
    throw error;
  }
}

// 追加購入枠の更新（アトミックインクリメント）
export async function incrementOCRQuotaFirestore(uid: string, amount: number): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  await setDoc(userRef, { ocrQuotaBalance: increment(amount) }, { merge: true });
}

export async function incrementChatQuotaFirestore(uid: string, amount: number): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  await setDoc(userRef, { chatQuotaBalance: increment(amount) }, { merge: true });
}

// 追加購入枠の消費（-1）
export async function decrementOCRQuotaFirestore(uid: string): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  await setDoc(userRef, { ocrQuotaBalance: increment(-1) }, { merge: true });
}

export async function decrementChatQuotaFirestore(uid: string): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  await setDoc(userRef, { chatQuotaBalance: increment(-1) }, { merge: true });
}

// プラン更新
export async function updatePlan(uid: string, plan: SubscriptionPlan): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  await setDoc(userRef, { plan }, { merge: true });
}

// ユーザー情報の再取得（月次リセットチェック付き）
export async function refreshUser(uid: string): Promise<User | null> {
  if (!isFirebaseAvailable || !auth || !firestore) return null;
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  try {
    // 月次リセットが必要かチェック＆実行
    await checkAndResetMonthly(uid);

    const userRef = doc(firestore, 'users', uid);
    const snap = await withTimeout(getDoc(userRef), 10000, 'refreshUser timed out');
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      uid: currentUser.uid,
      email: currentUser.email || '',
      displayName: currentUser.displayName || '',
      photoURL: currentUser.photoURL || undefined,
      plan: data.plan as SubscriptionPlan,
      ocrUsedThisMonth: data.ocrUsedThisMonth || 0,
      chatUsedThisMonth: data.chatUsedThisMonth || 0,
      ocrQuotaBalance: data.ocrQuotaBalance || 0,
      chatQuotaBalance: data.chatQuotaBalance || 0,
      planResetDate: data.planResetDate || new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[Auth] refreshUser failed:', e);
    return null;
  }
}

// 月次リセットチェック＆実行
async function checkAndResetMonthly(uid: string): Promise<void> {
  if (!isFirebaseAvailable || !auth || !firestore) return;

  try {
    const userRef = doc(firestore, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const planResetDate = data.planResetDate;

    // planResetDateがない、または月が変わっている場合はCloud Functionを呼び出し
    if (!planResetDate) {
      await callResetMonthlyFunction(uid);
      return;
    }

    const resetDate = new Date(planResetDate);
    const now = new Date();
    const isMonthChanged =
      resetDate.getFullYear() !== now.getFullYear() ||
      resetDate.getMonth() !== now.getMonth();

    if (isMonthChanged) {
      await callResetMonthlyFunction(uid);
    }
  } catch (e) {
    console.warn('[Auth] checkAndResetMonthly failed:', e);
  }
}

// Cloud Functionを呼び出して月次リセット実行
async function callResetMonthlyFunction(uid: string): Promise<void> {
  if (!auth?.currentUser) return;

  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(
      'https://resetmonthlyusageifneeded-ztboupv3ja-uc.a.run.app',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('[Auth] resetMonthlyUsageIfNeeded failed:', errorText);
    } else {
      const result = await response.json();
      console.log('[Auth] resetMonthlyUsageIfNeeded result:', result);
    }
  } catch (e) {
    console.warn('[Auth] callResetMonthlyFunction failed:', e);
  }
}

// 認証状態の監視
export function onAuthChange(callback: (user: any) => void): () => void {
  if (!isFirebaseAvailable || !auth) {
    // Firebaseが利用不可の場合は即座にnullを返して終了
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentFirebaseUser(): any {
  if (!isFirebaseAvailable || !auth) return null;
  return auth.currentUser;
}

// ============================
// シーズンランク関連
// ============================

/**
 * シーズンのスキャン数を更新（Firestore）
 */
export async function updateSeasonScanCount(uid: string, seasonId: string, scanCount: number): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  
  const seasonStatsRef = doc(firestore, 'seasonStats', `${uid}_${seasonId}`);
  await setDoc(seasonStatsRef, {
    userId: uid,
    seasonId,
    scanCount,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * シーズンのスキャン数を取得（Firestore）
 */
export async function getSeasonScanCount(uid: string, seasonId: string): Promise<number> {
  if (!isFirebaseAvailable || !firestore) return 0;
  
  const seasonStatsRef = doc(firestore, 'seasonStats', `${uid}_${seasonId}`);
  const snap = await getDoc(seasonStatsRef);
  
  if (!snap.exists()) return 0;
  return snap.data().scanCount || 0;
}

/**
 * 指定シーズンの全ユーザーのスキャン数を取得し、降順にソート
 */
export async function getAllSeasonScans(seasonId: string): Promise<SeasonScanStats[]> {
  if (!isFirebaseAvailable || !firestore) return [];
  
  const seasonStatsQuery = query(
    collection(firestore, 'seasonStats'),
    where('seasonId', '==', seasonId),
    orderBy('scanCount', 'desc')
  );
  
  const snapshot = await getDocs(seasonStatsQuery);
  const results: SeasonScanStats[] = [];
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    results.push({
      seasonId: data.seasonId,
      userId: data.userId,
      scanCount: data.scanCount || 0,
      updatedAt: data.updatedAt,
    });
  });
  
  return results;
}

/**
 * 自分のシーズンランキングとパーセンタイルを計算
 */
export async function getMySeasonRanking(uid: string, seasonId: string): Promise<{
  ranking: number;
  totalUsers: number;
  percentile: number;
  myScanCount: number;
}> {
  const allScans = await getAllSeasonScans(seasonId);
  const totalUsers = allScans.length;
  
  if (totalUsers === 0) {
    return { ranking: 0, totalUsers: 0, percentile: 0, myScanCount: 0 };
  }
  
  const myIndex = allScans.findIndex((s) => s.userId === uid);
  
  if (myIndex === -1) {
    // 自分のデータが見つからない場合
    return { ranking: totalUsers + 1, totalUsers, percentile: 0, myScanCount: 0 };
  }
  
  const ranking = myIndex + 1;
  const myScanCount = allScans[myIndex].scanCount;
  const percentile = Math.round(((totalUsers - ranking + 1) / totalUsers) * 100);
  
  return { ranking, totalUsers, percentile, myScanCount };
}

// ============================
// コイン管理（Firestore）
// ============================

/**
 * Firestoreからコイン残高を取得
 */
export async function getFirestoreCoinBalance(uid: string): Promise<number> {
  if (!isFirebaseAvailable || !firestore) return 0;
  try {
    const userRef = doc(firestore, 'users', uid);
    const snap = await withTimeout(getDoc(userRef), 10000, 'getCoinBalance timed out');
    if (!snap.exists()) return 0;
    return snap.data().coinBalance || 0;
  } catch (e) {
    console.warn('[Coins] getFirestoreCoinBalance failed:', e);
    return 0;
  }
}

/**
 * Firestoreにコイン取引を記録し、残高を更新
 */
export async function addFirestoreCoinTransaction(
  uid: string,
  type: 'purchase' | 'use' | 'bonus',
  amount: number,
  description: string
): Promise<CoinTransaction | null> {
  if (!isFirebaseAvailable || !firestore) return null;
  try {
    const now = new Date().toISOString();

    // 残高を更新（atomicにincrement）— これが最重要
    const userRef = doc(firestore, 'users', uid);
    await setDoc(userRef, { coinBalance: increment(amount) }, { merge: true });

    // 取引履歴の記録（失敗しても残高は既に更新済み）
    let txId = '';
    try {
      const txRef = collection(firestore, 'users', uid, 'coinTransactions');
      const docRef = await addDoc(txRef, {
        type,
        amount,
        description,
        createdAt: now,
      });
      txId = docRef.id;
    } catch (txError) {
      console.warn('[Coins] coinTransaction記録失敗（残高は更新済み）:', txError);
    }

    return { id: txId, type, amount, description, createdAt: now };
  } catch (e) {
    console.warn('[Coins] addFirestoreCoinTransaction failed:', e);
    return null;
  }
}

/**
 * Firestoreからコイン取引履歴を取得
 */
export async function getFirestoreCoinTransactions(uid: string, count: number = 50): Promise<CoinTransaction[]> {
  if (!isFirebaseAvailable || !firestore) return [];
  try {
    const txQuery = query(
      collection(firestore, 'users', uid, 'coinTransactions'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(count)
    );
    const snapshot = await withTimeout(getDocs(txQuery), 10000, 'getCoinTransactions timed out');
    const results: CoinTransaction[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      results.push({
        id: d.id,
        type: data.type as 'purchase' | 'use' | 'bonus',
        amount: data.amount,
        description: data.description,
        createdAt: data.createdAt,
      });
    });
    return results;
  } catch (e) {
    console.warn('[Coins] getFirestoreCoinTransactions failed:', e);
    return [];
  }
}

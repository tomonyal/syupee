import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  inMemoryPersistence,
  Auth,
  User as FirebaseUser,
} from 'firebase/auth';

// getReactNativePersistence を動的に読み込み（Firebase バージョンにより利用可否が異なる）
let reactNativePersistence: any = null;
try {
  const authModule = require('firebase/auth');
  if (authModule.getReactNativePersistence) {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    reactNativePersistence = authModule.getReactNativePersistence(AsyncStorage);
  }
} catch (e) {
  // フォールバック: inMemoryPersistence を使用
}
import {
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
  increment,
  Firestore,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, GOOGLE_CONFIG } from './config';
import { User, SubscriptionPlan, SeasonScanStats } from '../types';

// Google Sign-In を動的に読み込み（Expo Go では利用不可）
let GoogleSignin: any = null;
let isGoogleSignInAvailable = false;
try {
  const googleSignInModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignInModule.GoogleSignin;
  isGoogleSignInAvailable = true;
} catch (e) {
  console.warn('Google Sign-In is not available (running in Expo Go?)');
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let isFirebaseAvailable = false;

// 初期化
export function initFirebase(): void {
  // Firebase設定が空の場合はスキップ（開発モード）
  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    console.warn('Firebase config is missing. Running in offline/dev mode.');
    return;
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(FIREBASE_CONFIG);
      auth = initializeAuth(app, {
        persistence: reactNativePersistence || inMemoryPersistence,
      });
    } else {
      app = getApps()[0];
      auth = getAuth(app);
    }
    firestore = getFirestore(app);
    isFirebaseAvailable = true;

    if (isGoogleSignInAvailable && GoogleSignin) {
      GoogleSignin.configure({
        webClientId: GOOGLE_CONFIG.webClientId,
      });
    }
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
    isFirebaseAvailable = false;
  }
}

// モック用ユーザー（Expo Go 開発用）
function createMockUser(): User {
  return {
    uid: 'dev-user-001',
    email: 'dev@example.com',
    displayName: '開発ユーザー',
    photoURL: undefined,
    plan: 'light',
    ocrUsedThisMonth: 0,
    chatUsedThisMonth: 0,
    planResetDate: new Date().toISOString(),
  };
}

// Google Sign-In
export async function signInWithGoogle(): Promise<User> {
  // Firebaseが利用不可またはExpo Go ではモックユーザーを返す
  if (!isFirebaseAvailable || !isGoogleSignInAvailable || !GoogleSignin) {
    console.warn('Using mock user for development.');
    return createMockUser();
  }

  await GoogleSignin.hasPlayServices();
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken;

  if (!idToken) {
    throw new Error('Google Sign-In failed: No ID token');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const firebaseUser = userCredential.user;

  // Firestoreからユーザー情報を取得/作成
  const user = await getOrCreateUser(firebaseUser);
  return user;
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

// ユーザー情報の取得/作成
async function getOrCreateUser(firebaseUser: FirebaseUser): Promise<User> {
  const userRef = doc(firestore, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || undefined,
      plan: data.plan as SubscriptionPlan,
      ocrUsedThisMonth: data.ocrUsedThisMonth || 0,
      chatUsedThisMonth: data.chatUsedThisMonth || 0,
      planResetDate: data.planResetDate || new Date().toISOString(),
    };
  }

  // 新規ユーザー作成
  const newUser: User = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
    photoURL: firebaseUser.photoURL || undefined,
    plan: 'light',
    ocrUsedThisMonth: 0,
    chatUsedThisMonth: 0,
    planResetDate: new Date().toISOString(),
  };

  await setDoc(userRef, {
    plan: newUser.plan,
    ocrUsedThisMonth: 0,
    chatUsedThisMonth: 0,
    planResetDate: newUser.planResetDate,
    createdAt: new Date().toISOString(),
  });

  return newUser;
}

// 使用回数の更新
export async function incrementOCRUsage(uid: string): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const current = snap.data().ocrUsedThisMonth || 0;
    await updateDoc(userRef, { ocrUsedThisMonth: current + 1 });
  }
}

export async function incrementChatUsage(uid: string): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const current = snap.data().chatUsedThisMonth || 0;
    await updateDoc(userRef, { chatUsedThisMonth: current + 1 });
  }
}

// プラン更新
export async function updatePlan(uid: string, plan: SubscriptionPlan): Promise<void> {
  if (!isFirebaseAvailable || !firestore) return;
  const userRef = doc(firestore, 'users', uid);
  await updateDoc(userRef, { plan });
}

// ユーザー情報の再取得
export async function refreshUser(uid: string): Promise<User | null> {
  if (!isFirebaseAvailable || !auth || !firestore) return null;
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const userRef = doc(firestore, 'users', uid);
  const snap = await getDoc(userRef);
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
    planResetDate: data.planResetDate || new Date().toISOString(),
  };
}

// 認証状態の監視
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (!isFirebaseAvailable || !auth) {
    // Firebaseが利用不可の場合は即座にnullを返して終了
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function getCurrentFirebaseUser(): FirebaseUser | null {
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

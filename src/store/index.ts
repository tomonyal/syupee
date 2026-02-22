import { create } from 'zustand';
import { User, Expense, MonthlySummary, ChatMessage, MonthlyBudget, CategoryBudget, CoinTransaction, UserRank } from '../types';
import {
  signInWithGoogle,
  signOut as firebaseSignOut,
  refreshUser,
  incrementOCRUsage,
  incrementChatUsage,
  updatePlan,
} from '../services/firebase';
import {
  getRecentExpenses,
  getMonthlySummary,
  getMultiMonthSummary,
  insertExpense,
  deleteExpense,
  getExpenses,
} from '../database/expenses';
import {
  insertChatMessage,
  getRecentChatMessages,
  getAllChatMessages,
  clearChatHistory,
} from '../database/chat';
import { saveBudget, getBudget } from '../database/budget';
import {
  getCoinBalance,
  purchaseCoins,
  useCoinsForScan,
  addBonusCoins,
  getCoinTransactions,
  getMonthlyScansCount,
  processMonthlyRankReset,
} from '../database/coins';
import {
  getOCRQuotaBalance,
  purchaseOCRQuota,
  useOCRQuota,
  carryOverQuota,
  getChatQuotaBalance,
  purchaseChatQuota,
  carryOverChatQuota,
} from '../database/quota';
import {
  getMonthlyUsage,
  incrementLocalOCRUsage,
  incrementLocalChatUsage,
} from '../database/usage';
import {
  initializePurchases,
  isPurchasesAvailable,
  loginPurchaseUser,
  logoutPurchaseUser,
  getOfferings,
  purchaseCoinPackage,
  purchasePlanSubscription,
  getCurrentPlan,
  getPlanFromCustomerInfo,
  restorePurchases,
  CoinOffering,
  PlanOffering,
} from '../services/purchases';
import { recognizeReceipt } from '../services/ocr';
import { parseReceiptText, getAIChatResponse, allocateBudgetByAI } from '../services/openai';
import { PLAN_MAP, COIN_PER_SCAN, COIN_PACKAGES, getRankFromScans, getRankFromPercentile, calculatePercentile } from '../constants';
import { OCRResult, ParsedReceipt, ExpenseCategory, RankInfo } from '../types';
import { getCurrentSeason, getPreviousSeason, getSeasonDisplayName, type Season } from '../utils';
import { updateSeasonScanCount, getMySeasonRanking } from '../services/firebase';

// ============================
// Auth Store
// ============================
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  signIn: async () => {
    set({ isLoading: true });
    try {
      const user = await signInWithGoogle();
      set({ user, isAuthenticated: true, isLoading: false });

      // RevenueCat初期化 & ユーザー紐づけ
      await initializePurchases(user.uid);
      await loginPurchaseUser(user.uid);

      // ストアのサブスク状態を反映
      if (isPurchasesAvailable()) {
        const plan = await getCurrentPlan();
        if (plan !== user.plan) {
          set({ user: { ...user, plan } });
        }
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await logoutPurchaseUser();
      await firebaseSignOut();
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  refresh: async () => {
    const { user } = get();
    if (!user) return;
    const refreshed = await refreshUser(user.uid);
    if (refreshed) set({ user: refreshed });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));

// ============================
// Expense Store
// ============================
interface ExpenseState {
  recentExpenses: Expense[];
  currentMonthSummary: MonthlySummary | null;
  selectedMonth: string;
  selectedCategory: ExpenseCategory | null;
  filteredExpenses: Expense[];
  isLoading: boolean;
  error: string | null;

  loadRecentExpenses: () => Promise<void>;
  loadMonthlySummary: (month?: string) => Promise<void>;
  loadFilteredExpenses: () => Promise<void>;
  setSelectedMonth: (month: string) => void;
  setSelectedCategory: (category: ExpenseCategory | null) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  removeExpense: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  recentExpenses: [],
  currentMonthSummary: null,
  selectedMonth: getCurrentMonth(),
  selectedCategory: null,
  filteredExpenses: [],
  isLoading: false,
  error: null,

  loadRecentExpenses: async () => {
    try {
      const expenses = await getRecentExpenses(20);
      set({ recentExpenses: expenses });
    } catch (error) {
      set({ error: '支出データの読み込みに失敗しました' });
    }
  },

  loadMonthlySummary: async (month?: string) => {
    const targetMonth = month || get().selectedMonth;
    try {
      const summary = await getMonthlySummary(targetMonth);
      set({ currentMonthSummary: summary });
    } catch (error) {
      set({ error: 'サマリーの読み込みに失敗しました' });
    }
  },

  loadFilteredExpenses: async () => {
    const { selectedMonth, selectedCategory } = get();
    set({ isLoading: true });
    try {
      const expenses = await getExpenses({
        month: selectedMonth,
        category: selectedCategory || undefined,
      });
      set({ filteredExpenses: expenses, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: '支出の読み込みに失敗しました' });
    }
  },

  setSelectedMonth: (month) => {
    set({ selectedMonth: month });
    get().loadFilteredExpenses();
    get().loadMonthlySummary(month);
  },

  setSelectedCategory: (category) => {
    set({ selectedCategory: category });
    get().loadFilteredExpenses();
  },

  addExpense: async (expense) => {
    const id = await insertExpense(expense);
    await get().loadRecentExpenses();
    await get().loadMonthlySummary();
    await get().loadFilteredExpenses();
    return id;
  },

  removeExpense: async (id) => {
    await deleteExpense(id);
    await get().loadRecentExpenses();
    await get().loadMonthlySummary();
    await get().loadFilteredExpenses();
  },
}));

// ============================
// Usage Store（ローカルDB使用回数管理）
// ============================
interface UsageState {
  ocrUsedThisMonth: number;
  chatUsedThisMonth: number;
  isLoading: boolean;

  loadUsage: () => Promise<void>;
  incrementOCR: () => Promise<void>;
  incrementChat: () => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  ocrUsedThisMonth: 0,
  chatUsedThisMonth: 0,
  isLoading: false,

  loadUsage: async () => {
    set({ isLoading: true });
    try {
      const usage = await getMonthlyUsage();
      set({
        ocrUsedThisMonth: usage.ocrCount,
        chatUsedThisMonth: usage.chatCount,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  incrementOCR: async () => {
    try {
      const newCount = await incrementLocalOCRUsage();
      set({ ocrUsedThisMonth: newCount });
    } catch {
      // エラーは無視
    }
  },

  incrementChat: async () => {
    try {
      const newCount = await incrementLocalChatUsage();
      set({ chatUsedThisMonth: newCount });
    } catch {
      // エラーは無視
    }
  },
}));

// ============================
// Scan Store
// ============================
interface ScanState {
  imageUri: string | null;
  ocrResult: OCRResult | null;
  parsedReceipt: ParsedReceipt | null;
  isProcessing: boolean;
  step: 'camera' | 'processing' | 'confirm' | 'edit';
  error: string | null;

  setImageUri: (uri: string) => void;
  processImage: (uid: string) => Promise<void>;
  reset: () => void;
  setParsedReceipt: (receipt: ParsedReceipt) => void;
}

export const useScanStore = create<ScanState>((set, get) => ({
  imageUri: null,
  ocrResult: null,
  parsedReceipt: null,
  isProcessing: false,
  step: 'camera',
  error: null,

  setImageUri: (uri) => set({ imageUri: uri }),

  processImage: async (uid: string) => {
    const { imageUri } = get();
    if (!imageUri) return;

    set({ isProcessing: true, step: 'processing', error: null });
    try {
      // OCR実行
      const ocrResult = await recognizeReceipt(imageUri);
      set({ ocrResult });

      // AI構造化
      const parsed = await parseReceiptText(ocrResult.rawText);
      set({ parsedReceipt: parsed, step: 'confirm', isProcessing: false });

      // 使用回数加算（ローカルDB + Firebase）
      await useUsageStore.getState().incrementOCR();
      await incrementOCRUsage(uid);
    } catch (error: any) {
      set({
        error: error.message || 'レシートの処理に失敗しました',
        isProcessing: false,
        step: 'camera',
      });
    }
  },

  reset: () =>
    set({
      imageUri: null,
      ocrResult: null,
      parsedReceipt: null,
      isProcessing: false,
      step: 'camera',
      error: null,
    }),

  setParsedReceipt: (receipt) => set({ parsedReceipt: receipt }),
}));

// ============================
// Chat Store
// ============================
interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;

  loadMessages: () => Promise<void>;
  sendMessage: (content: string, uid: string) => Promise<void>;
  clearChat: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  loadMessages: async () => {
    try {
      const messages = await getAllChatMessages();
      set({ messages });
    } catch (error) {
      set({ error: 'チャット履歴の読み込みに失敗しました' });
    }
  },

  sendMessage: async (content, uid) => {
    set({ isLoading: true, error: null });
    try {
      // ユーザーメッセージを保存
      const userMsg = await insertChatMessage('user', content);
      set((state) => ({ messages: [...state.messages, userMsg] }));

      // 直近の会話コンテキストを取得
      const recentMessages = await getRecentChatMessages();

      // AI応答を取得
      const aiResponse = await getAIChatResponse(content, recentMessages);

      // AI応答を保存
      const aiMsg = await insertChatMessage('assistant', aiResponse);
      set((state) => ({
        messages: [...state.messages, aiMsg],
        isLoading: false,
      }));

      // 使用回数加算（ローカルDB + Firebase）
      await useUsageStore.getState().incrementChat();
      await incrementChatUsage(uid);
    } catch (error: any) {
      const errorMessage = error.message || 'メッセージの送信に失敗しました';
      set({
        isLoading: false,
        error: errorMessage,
      });
      
      // 5秒後にエラーメッセージを自動でクリア
      setTimeout(() => {
        set({ error: null });
      }, 5000);
    }
  },

  clearChat: async () => {
    await clearChatHistory();
    set({ messages: [] });
  },
}));

// ============================
// Budget Store
// ============================
interface BudgetState {
  budget: MonthlyBudget | null;
  selectedMonth: string;
  isLoading: boolean;
  isAllocating: boolean;
  error: string | null;

  setSelectedMonth: (month: string) => void;
  loadBudget: (month?: string) => Promise<void>;
  saveAllBudgets: (totalBudget: number, categoryBudgets: CategoryBudget[], isRecurring?: boolean) => Promise<void>;
  allocateWithAI: (totalBudget: number) => Promise<CategoryBudget[]>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budget: null,
  selectedMonth: getCurrentMonth(),
  isLoading: false,
  isAllocating: false,
  error: null,

  setSelectedMonth: (month) => {
    set({ selectedMonth: month });
    get().loadBudget(month);
  },

  loadBudget: async (month?: string) => {
    const targetMonth = month || get().selectedMonth;
    set({ isLoading: true, error: null });
    try {
      const budget = await getBudget(targetMonth);
      set({ budget, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: '予算データの読み込みに失敗しました' });
    }
  },

  saveAllBudgets: async (totalBudget, categoryBudgets, isRecurring = false) => {
    const { selectedMonth } = get();
    set({ isLoading: true, error: null });
    try {
      await saveBudget(selectedMonth, totalBudget, categoryBudgets, isRecurring);
      await get().loadBudget(selectedMonth);
      set({ isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: '予算の保存に失敗しました' });
      throw error;
    }
  },

  allocateWithAI: async (totalBudget) => {
    const { selectedMonth } = get();
    set({ isAllocating: true, error: null });
    try {
      const allocations = await allocateBudgetByAI(totalBudget, selectedMonth);
      set({ isAllocating: false });
      return allocations;
    } catch (error: any) {
      set({ isAllocating: false, error: error.message || '予算の配分に失敗しました' });
      throw error;
    }
  },
}));

// ============================
// Coin Store
// ============================
interface CoinState {
  balance: number;
  transactions: CoinTransaction[];
  monthlyScans: number;
  seasonScans: number; // シーズンスキャン数
  rank: RankInfo;
  percentile: number; // 上位○%
  totalUsers: number; // シーズンの総ユーザー数
  currentSeason: Season;
  ocrQuotaBalance: number; // OCR枠の残高
  chatQuotaBalance: number; // AI相談枠の残高
  isLoading: boolean;
  error: string | null;

  loadCoinData: () => Promise<void>;
  loadSeasonRank: () => Promise<void>;
  purchase: (coins: number, price: number) => Promise<void>;
  purchaseQuota: (quota: number, coinCost: number) => Promise<void>;
  purchaseChatQuota: (quota: number, coinCost: number) => Promise<void>;
  useForScan: () => Promise<void>;
  addBonus: (amount: number, reason: string) => Promise<void>;
  canScan: () => boolean;
}

export const useCoinStore = create<CoinState>((set, get) => ({
  balance: 0,
  transactions: [],
  monthlyScans: 0,
  seasonScans: 0,
  rank: getRankFromScans(0),
  percentile: 0,
  totalUsers: 0,
  currentSeason: getCurrentSeason(),
  ocrQuotaBalance: 0,
  chatQuotaBalance: 0,
  isLoading: false,
  error: null,

  loadCoinData: async () => {
    set({ isLoading: true });
    try {
      // 月初の繰り越し処理
      await carryOverQuota();
      await carryOverChatQuota();
      
      // 月次ランクリセット処理（前月の報酬を付与）
      const rankResetResult = await processMonthlyRankReset();
      
      const [balance, transactions, monthlyScans, ocrQuotaBalance, chatQuotaBalance] = await Promise.all([
        getCoinBalance(),
        getCoinTransactions(50),
        getMonthlyScansCount(),
        getOCRQuotaBalance(),
        getChatQuotaBalance(),
      ]);
      
      set({
        balance,
        transactions,
        monthlyScans,
        ocrQuotaBalance,
        chatQuotaBalance,
        rank: getRankFromScans(monthlyScans),
        isLoading: false,
      });
      
      // シーズンランクも読み込む
      await get().loadSeasonRank();
    } catch (error) {
      set({ isLoading: false, error: 'コインデータの読み込みに失敗しました' });
    }
  },

  loadSeasonRank: async () => {
    try {
      const { user } = useAuthStore.getState();
      if (!user) return;
      
      const season = getCurrentSeason();
      const { ranking, totalUsers, percentile, myScanCount } = await getMySeasonRanking(user.uid, season.seasonId);
      
      // パーセンタイルからランクを決定
      const rank = getRankFromPercentile(percentile);
      
      set({
        seasonScans: myScanCount,
        rank,
        percentile,
        totalUsers,
        currentSeason: season,
      });
    } catch (error) {
      console.error('シーズンランクの読み込みに失敗:', error);
    }
  },

  purchase: async (coins, price) => {
    set({ isLoading: true, error: null });
    try {
      await purchaseCoins(coins, price);
      await get().loadCoinData();
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  purchaseQuota: async (quota, coinCost) => {
    const { balance } = get();
    if (balance < coinCost) {
      throw new Error(`コインが足りません（必要: ${coinCost}コイン、残高: ${balance}コイン）`);
    }
    set({ isLoading: true, error: null });
    try {
      // コインを消費して枠を購入
      await useCoinsForScan(coinCost);
      await purchaseOCRQuota(quota, coinCost);
      await get().loadCoinData();
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  purchaseChatQuota: async (quota, coinCost) => {
    const { balance } = get();
    if (balance < coinCost) {
      throw new Error(`コインが足りません（必要: ${coinCost}コイン、残高: ${balance}コイン）`);
    }
    set({ isLoading: true, error: null });
    try {
      // コインを消費して枠を購入
      await useCoinsForScan(coinCost);
      await purchaseChatQuota(quota, coinCost);
      await get().loadCoinData();
    } catch (error: any) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  useForScan: async () => {
    const { balance, seasonScans, currentSeason } = get();
    if (balance < COIN_PER_SCAN) {
      throw new Error(`コインが足りません（必要: ${COIN_PER_SCAN}コイン、残高: ${balance}コイン）`);
    }
    try {
      await useCoinsForScan(COIN_PER_SCAN);
      
      // シーズンスキャン数をFirestoreに更新
      const { user } = useAuthStore.getState();
      if (user) {
        const newSeasonScans = seasonScans + 1;
        await updateSeasonScanCount(user.uid, currentSeason.seasonId, newSeasonScans);
        set({ seasonScans: newSeasonScans });
      }
      
      await get().loadCoinData();
    } catch (error: any) {
      throw error;
    }
  },

  addBonus: async (amount, reason) => {
    try {
      await addBonusCoins(amount, reason);
      await get().loadCoinData();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  canScan: () => {
    return get().balance >= COIN_PER_SCAN;
  },
}));

// ============================
// Purchase Store（IAP管理）
// ============================
interface PurchaseState {
  coinOfferings: CoinOffering[];
  planOfferings: PlanOffering[];
  isLoadingOfferings: boolean;
  isPurchasing: boolean;
  error: string | null;

  loadOfferings: () => Promise<void>;
  buyCoinPackage: (offering: CoinOffering) => Promise<boolean>;
  buyPlanSubscription: (offering: PlanOffering) => Promise<boolean>;
  restore: () => Promise<void>;
}

export const usePurchaseStore = create<PurchaseState>((set, get) => ({
  coinOfferings: [],
  planOfferings: [],
  isLoadingOfferings: false,
  isPurchasing: false,
  error: null,

  loadOfferings: async () => {
    if (!isPurchasesAvailable()) return;
    set({ isLoadingOfferings: true, error: null });
    try {
      const result = await getOfferings();
      if (result) {
        set({
          coinOfferings: result.coinPackages,
          planOfferings: result.planPackages,
          isLoadingOfferings: false,
        });
      } else {
        set({ isLoadingOfferings: false });
      }
    } catch (error: any) {
      set({ isLoadingOfferings: false, error: error.message });
    }
  },

  buyCoinPackage: async (offering) => {
    set({ isPurchasing: true, error: null });
    try {
      const result = await purchaseCoinPackage(offering);

      if (result.cancelled) {
        set({ isPurchasing: false });
        return false;
      }

      if (!result.success) {
        set({ isPurchasing: false, error: result.error });
        return false;
      }

      // 決済成功 → パッケージIDからコイン数を特定してローカルDBに付与
      const coinPkg = COIN_PACKAGES.find((p) =>
        offering.packageId === p.id
      );
      if (coinPkg) {
        await purchaseCoins(coinPkg.coins, offering.price);
        await useCoinStore.getState().loadCoinData();
      }

      set({ isPurchasing: false });
      return true;
    } catch (error: any) {
      set({ isPurchasing: false, error: error.message });
      return false;
    }
  },

  buyPlanSubscription: async (offering) => {
    set({ isPurchasing: true, error: null });
    try {
      const result = await purchasePlanSubscription(offering);

      if (result.cancelled) {
        set({ isPurchasing: false });
        return false;
      }

      if (!result.success) {
        set({ isPurchasing: false, error: result.error });
        return false;
      }

      // 決済成功 → CustomerInfoからプランを判定してユーザー情報を更新
      if (result.customerInfo) {
        const newPlan = getPlanFromCustomerInfo(result.customerInfo);
        const user = useAuthStore.getState().user;
        if (user) {
          useAuthStore.getState().setUser({ ...user, plan: newPlan });
          await updatePlan(user.uid, newPlan);
        }
      }

      set({ isPurchasing: false });
      return true;
    } catch (error: any) {
      set({ isPurchasing: false, error: error.message });
      return false;
    }
  },

  restore: async () => {
    set({ isPurchasing: true, error: null });
    try {
      const { plan } = await restorePurchases();
      const user = useAuthStore.getState().user;
      if (user && plan !== user.plan) {
        useAuthStore.getState().setUser({ ...user, plan });
        await updatePlan(user.uid, plan);
      }
      set({ isPurchasing: false });
    } catch (error: any) {
      set({ isPurchasing: false, error: error.message });
    }
  },
}));

// ============================
// ヘルパー
// ============================
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

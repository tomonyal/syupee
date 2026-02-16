import { create } from 'zustand';
import { User, Expense, MonthlySummary, ChatMessage, MonthlyBudget, CategoryBudget } from '../types';
import {
  signInWithGoogle,
  signOut as firebaseSignOut,
  refreshUser,
  incrementOCRUsage,
  incrementChatUsage,
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
import { recognizeReceipt } from '../services/ocr';
import { parseReceiptText, getAIChatResponse, allocateBudgetByAI } from '../services/openai';
import { PLAN_MAP } from '../constants';
import { OCRResult, ParsedReceipt, ExpenseCategory } from '../types';

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
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
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

      // 使用回数加算
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

      // 使用回数加算
      await incrementChatUsage(uid);
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message || 'メッセージの送信に失敗しました',
      });
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
// ヘルパー
// ============================
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

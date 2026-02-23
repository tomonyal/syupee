import { GEMINI_CONFIG } from './config';
import { ParsedReceipt, ChatMessage, MonthlySummary, ExpenseCategory, CategoryBudget, MonthlyBudget } from '../types';
import { CATEGORIES, CATEGORY_MAP, ADVICE_MONTHS } from '../constants';
import { getMultiMonthSummary, getBudget, getSetting, setSetting } from '../database';

// レート制限対策：最後のリクエスト時刻を記録
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 最小リクエスト間隔（ミリ秒）

/**
 * レシートOCRテキストをJSON構造化する
 */
export async function parseReceiptText(ocrText: string): Promise<ParsedReceipt> {
  const categoryList = CATEGORIES.map((c) => `${c.key}: ${c.label}`).join(', ');

  const systemPrompt = `あなたはレシート解析AIです。与えられたOCRテキストからレシート情報を抽出し、必ず以下のJSON形式で返してください。余計な説明は不要です。

{
  "storeName": "店名",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "商品名", "price": 数値, "quantity": 数値, "category": "カテゴリキー" }
  ],
  "totalAmount": 合計金額(数値),
  "suggestedCategory": "カテゴリキー"
}

利用可能カテゴリ: ${categoryList}

注意:
- 日付が不明な場合は今日の日付を使う
- 店名不明なら"不明"
- 金額は数値のみ（円記号なし）
- 小計・税込合計があれば税込金額を使う
- **重要**: すべての明細（items）に必ず最適なcategoryを個別に割り当ててください。商品名から判断し、食品なら"food"、洗剤なら"daily_necessities"など、1つずつ適切なカテゴリキーを設定すること
- suggestedCategoryはレシート全体の主要カテゴリを設定
- 合計金額は明細の合計と整合性を取る`;

  const response = await callGemini(systemPrompt, ocrText);

  try {
    // JSONを抽出
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSONが見つかりません');

    const parsed = JSON.parse(jsonMatch[0]);
    const suggestedCategory = validateCategory(parsed.suggestedCategory);

    return {
      storeName: parsed.storeName || '不明',
      date: parsed.date || new Date().toISOString().split('T')[0],
      items: (parsed.items || []).map((item: any) => ({
        name: item.name || '',
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        category: validateCategory(item.category || suggestedCategory),
      })),
      totalAmount: Number(parsed.totalAmount) || 0,
      suggestedCategory,
    };
  } catch (error) {
    throw new Error('レシートの解析に失敗しました。再度撮影してください。');
  }
}

/**
 * AIが合計予算をカテゴリ別に最適配分する
 */
export async function allocateBudgetByAI(
  totalBudget: number,
  month: string
): Promise<CategoryBudget[]> {
  // 過去の支出実績を取得
  let expenseContext = '';
  try {
    const summaries = await getMultiMonthSummary(ADVICE_MONTHS);
    expenseContext = buildExpenseContext(summaries);
  } catch {
    expenseContext = '（支出データの取得に失敗しました）';
  }

  const categoryList = CATEGORIES.map((c) => `"${c.key}": "${c.label}"`).join(', ');

  const systemPrompt = `あなたは家計の予算配分を行うAIです。
与えられた合計生活費予算を、各カテゴリに最適に配分してください。

利用可能カテゴリ: { ${categoryList} }

過去の支出データ:
${expenseContext}

以下のルールに従ってください:
1. 合計金額が予算と一致するようにする
2. 過去の支出傾向を参考にしつつ、無駄を抑えた配分にする
3. 全カテゴリに0以上の金額を割り当てる
4. 金額は100円単位で丸める
5. 必ず以下のJSON形式で返す。余計な説明は不要

{
  "allocations": [
    { "category": "カテゴリキー", "amount": 数値 }
  ]
}`;

  const userMessage = `${month}の合計生活費予算は${totalBudget.toLocaleString()}円です。各カテゴリに最適に配分してください。`;

  const response = await callGemini(systemPrompt, userMessage);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSONが見つかりません');

    const parsed = JSON.parse(jsonMatch[0]);
    const allocations = parsed.allocations as { category: string; amount: number }[];

    // 全カテゴリ分を確保
    const result: CategoryBudget[] = CATEGORIES.map((cat) => {
      const found = allocations.find((a) => a.category === cat.key);
      return {
        category: cat.key as ExpenseCategory,
        amount: found ? Math.round(found.amount / 100) * 100 : 0,
      };
    });

    // 合計が予算と一致するよう調整
    const currentTotal = result.reduce((sum, r) => sum + r.amount, 0);
    const diff = totalBudget - currentTotal;
    if (diff !== 0 && result.length > 0) {
      // 最大カテゴリで調整
      const maxIdx = result.reduce((mi, r, i, arr) => (r.amount > arr[mi].amount ? i : mi), 0);
      result[maxIdx].amount += diff;
    }

    return result;
  } catch (error) {
    throw new Error('予算配分の計算に失敗しました。再度お試しください。');
  }
}

/**
 * 節約アドバイス・チャット
 */
export async function getAIChatResponse(
  userMessage: string,
  chatHistory: ChatMessage[]
): Promise<string> {
  // 直近3ヶ月のサマリーを取得してプロンプトに含める
  let expenseContext = '';
  try {
    const summaries = await getMultiMonthSummary(ADVICE_MONTHS);
    expenseContext = buildExpenseContext(summaries);
  } catch {
    expenseContext = '（支出データの取得に失敗しました）';
  }

  // 直近3ヶ月の予算を取得してプロンプトに含める
  let budgetContext = '';
  try {
    budgetContext = await buildBudgetContext();
  } catch {
    budgetContext = '（予算データの取得に失敗しました）';
  }

  const systemPrompt = `あなたは「シュッピー」という名前の可愛い節約アドバイザーAIです。
ユーザーの家計簿データを元に、親しみやすく具体的な節約アドバイスをします。

キャラクター設定:
- 明るくポジティブな性格
- 語尾は「〜だよ！」「〜だね！」「〜しよう！」
- 褒め上手
- 具体的な数字を交えたアドバイスをする
- 絵文字を適度に使う

ユーザーの支出データ:
${expenseContext}

ユーザーの予算データ:
${budgetContext}

以下のルールに従ってください:
1. 1回のメッセージは200文字以内に収める
2. カテゴリ別の支出傾向を分析してアドバイスする
3. 前月との比較がある場合は言及する
4. 予算が設定されている場合は、予算と実績の差を踏まえてアドバイスする
5. 無理な節約は勧めない
6. 質問には丁寧に答える`;

  // 会話履歴をテキストに変換
  const historyText = chatHistory
    .map((msg) => `${msg.role === 'user' ? 'ユーザー' : 'シュッピー'}: ${msg.content}`)
    .join('\n');

  const fullUserMessage = historyText
    ? `${historyText}\nユーザー: ${userMessage}`
    : userMessage;

  return await callGemini(systemPrompt, fullUserMessage);
}

/**
 * 今日のアドバイスを取得（日付ごとにキャッシュ、毎日0時にリセット）
 */
export async function getDailyAdvice(): Promise<string | null> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // キャッシュチェック
  const cachedDate = await getSetting('daily_advice_date');
  if (cachedDate === today) {
    const cachedAdvice = await getSetting('daily_advice_text');
    if (cachedAdvice) return cachedAdvice;
  }

  // 支出データ取得
  let expenseContext = '';
  try {
    const summaries = await getMultiMonthSummary(ADVICE_MONTHS);
    expenseContext = buildExpenseContext(summaries);
  } catch {
    expenseContext = '（支出データの取得に失敗しました）';
  }

  // 予算データ取得
  let budgetContext = '';
  try {
    budgetContext = await buildBudgetContext();
  } catch {
    budgetContext = '（予算データの取得に失敗しました）';
  }

  // 支出データが全くない場合はアドバイスしない
  if (expenseContext === 'まだ支出データがありません。' && budgetContext === '予算が設定されていません。') {
    return null;
  }

  const systemPrompt = `あなたは「シュッピー」という名前の可愛い節約アドバイザーAIです。
毎日ユーザーに「今日のアドバイス」として、1つの具体的な節約アドバイスをします。

キャラクター設定:
- 明るくポジティブな性格
- 語尾は「〜だよ！」「〜だね！」「〜しよう！」
- 褒め上手
- 具体的な数字を交えたアドバイスをする
- 絵文字を適度に使う

ユーザーの支出データ:
${expenseContext}

ユーザーの予算データ:
${budgetContext}

ルール:
1. 150文字以内で収める
2. 予算と実績の差を踏まえる
3. 特に使い過ぎているカテゴリがあれば指摘する
4. 節約できている部分は褒める
5. 毎日違う切り口でアドバイスする
6. 無理な節約は勧めない`;

  const userMessage = `今日は${today}です。今月の支出と予算を踏まえて、今日の節約アドバイスを1つください。`;

  try {
    const advice = await callGemini(systemPrompt, userMessage);
    // キャッシュに保存
    await setSetting('daily_advice_date', today);
    await setSetting('daily_advice_text', advice);
    return advice;
  } catch {
    return null;
  }
}
async function callGemini(
  systemInstruction: string,
  userMessage: string,
  retryCount = 0
): Promise<string> {
  const { apiKey, model } = GEMINI_CONFIG;
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000; // 2秒

  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません');
  }

  // レート制限対策：前回のリクエストから最小間隔が経過するまで待機
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '';
      
      try {
        const errorJson = JSON.parse(errorText);
        const errorDetails = errorJson.error?.message || errorText;
        
        // RESOURCE_EXHAUSTEDエラーの詳細チェック
        if (errorDetails.includes('RESOURCE_EXHAUSTED') || errorDetails.includes('quota')) {
          errorMessage = 'AIサーバーが混雑しています。しばらく時間をおいてから再度お試しください🙏';
        }
      } catch {
        errorMessage = errorText;
      }
      
      // 429エラー（レート制限）の場合、リトライ
      if (response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retryCount); // エクスポネンシャルバックオフ
          console.log(`レート制限エラー。${delay}ms後にリトライします (${retryCount + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          return callGemini(systemInstruction, userMessage, retryCount + 1);
        }
        throw new Error(errorMessage || 'AIサーバーが混雑しています。しばらく時間をおいてから再度お試しください🙏');
      }

      // 500番台エラー（サーバーエラー）の場合もリトライ
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount);
        console.log(`サーバーエラー。${delay}ms後にリトライします (${retryCount + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        return callGemini(systemInstruction, userMessage, retryCount + 1);
      }

      throw new Error(errorMessage || `Gemini APIエラー: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini APIから応答が得られませんでした');
    }

    return text;
  } catch (error: any) {
    // ネットワークエラーなどの場合もリトライ
    if (retryCount < MAX_RETRIES && error.message.includes('fetch')) {
      const delay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`ネットワークエラー。${delay}ms後にリトライします (${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return callGemini(systemInstruction, userMessage, retryCount + 1);
    }
    throw error;
  }
}

/**
 * 指定ミリ秒待機するヘルパー関数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 支出コンテキストを構築
 */
function buildExpenseContext(summaries: MonthlySummary[]): string {
  if (summaries.length === 0 || summaries.every((s) => s.expenseCount === 0)) {
    return 'まだ支出データがありません。';
  }

  const lines: string[] = [];
  for (const summary of summaries) {
    if (summary.expenseCount === 0) continue;

    lines.push(`【${summary.month}】合計: ¥${summary.totalAmount.toLocaleString()} (${summary.expenseCount}件)`);

    for (const cat of summary.categoryBreakdown) {
      const info = CATEGORY_MAP[cat.category];
      lines.push(`  ${info?.label || cat.category}: ¥${cat.amount.toLocaleString()} (${cat.percentage.toFixed(1)}%)`);
    }
  }

  return lines.join('\n');
}

/**
 * 予算コンテキストを構築（直近3ヶ月分）
 */
async function buildBudgetContext(): Promise<string> {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < ADVICE_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const lines: string[] = [];
  for (const month of months) {
    const budget = await getBudget(month);
    if (!budget || budget.totalBudget <= 0) {
      lines.push(`【${month}】予算未設定`);
      continue;
    }
    lines.push(`【${month}】合計予算: ¥${budget.totalBudget.toLocaleString()}`);
    for (const cb of budget.categoryBudgets) {
      if (cb.amount <= 0) continue;
      const info = CATEGORY_MAP[cb.category];
      lines.push(`  ${info?.label || cb.category}: ¥${cb.amount.toLocaleString()}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : '予算が設定されていません。';
}

/**
 * カテゴリ文字列をバリデート
 */
function validateCategory(category: string): ExpenseCategory {
  if (CATEGORY_MAP[category as ExpenseCategory]) {
    return category as ExpenseCategory;
  }
  return 'other';
}

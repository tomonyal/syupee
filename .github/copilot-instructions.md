# シュッピー (syupee) - 開発ガイド

## プロジェクト概要

AI家計簿アプリ。レシート撮影（OCR）とAIチャットで支出管理を支援する。

- **アプリ名**: シュッピー (slug: syupee)
- **バンドルID**: `com.syupee.app`
- **Firebase プロジェクト**: `syupee-ebfaa`
- **運営者**: ともなり (tomonyal1224@gmail.com)
- **対象**: iOS (Android未対応)

## 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | React Native / Expo SDK 54 |
| 言語 | TypeScript |
| ローカルDB | SQLite (expo-sqlite) |
| サーバーDB | Firestore |
| 認証 | Firebase Auth + Google Sign-In |
| OCR | Azure AI Vision (`jp-instance.cognitiveservices.azure.com`) |
| AI | Google Gemini API (`generativelanguage.googleapis.com`) ※ファイル名は`openai.ts`だがGemini使用 |
| 決済 | Stripe (テストモード) |
| バックエンド | Firebase Cloud Functions 2nd Gen (Node.js 20) |
| 状態管理 | Zustand |
| ビルド | EAS Build |

## ディレクトリ構成

```
src/
  components/common/  # 共通UIコンポーネント
  constants/          # 定数（categories.ts にプラン定義あり）
  database/           # ローカルSQLite操作
  navigation/         # React Navigation設定
  screens/            # 画面コンポーネント
  services/           # 外部API連携 (firebase, ocr, openai, purchases, config)
  store/              # Zustand stores
  types/              # TypeScript型定義
  utils/              # ユーティリティ (csv, season, uuid)
functions/src/        # Firebase Cloud Functions
```

## 重要な設計パターン

### データの二重管理
- **ローカルSQLite**: 支出データ、チャット履歴、予算設定、利用設定 → 端末内のみ
- **Firestore**: ユーザー情報、プラン、使用量カウンタ、コイン残高、コイン取引 → サーバー管理
- 使用量は両方に保存。**表示はFirestore値を優先**（`useUsageStore.loadUsage`はAuthStoreのuserから取得）

### プラン体系
| プラン | 月額 | OCR | AI相談 |
|--------|------|-----|--------|
| free | ¥0 | 0 | 0 |
| light | ¥300 | 30 | 10 |
| standard | ¥600 | 100 | 50 |
| premium | ¥1,200 | 300 | 500 |

- デフォルトプランは `'free'`（すべてのフォールバック）
- `SubscriptionPlan` 型: `'free' | 'light' | 'standard' | 'premium'`
- PLANS定義: `src/constants/categories.ts`
- Stripe価格はPLANS定数と一致していること（過去に不一致バグあり）

### Firestore コレクション
- `users/{uid}` — plan, ocrUsedThisMonth, chatUsedThisMonth, ocrQuotaBalance, chatQuotaBalance, coinBalance, stripeCustomerId, stripeSubscriptionId, initialCoinStatus, initialCoinCouponCode, deviceId
- `users/{uid}/coinTransactions/{txId}` — コイン取引履歴
- `coupons/{code}` — クーポンコード（coinAmount, used, usedBy, usedAt）※クライアントからアクセス不可
- `seasonStats/{uid}_{seasonId}` — シーズンスキャン統計
- `abuseAlerts/{alertId}` — 不正利用検知ログ（クライアントからアクセス不可）

### 初回コインステータス (`initialCoinStatus`)
- `none` — 未申請（デフォルト）
- `requested` — ユーザーが申請済み（deviceId保存済み）
- `issued` — 管理者がクーポン発行済み（initialCoinCouponCode設定済み）
- `redeemed` — ユーザーがクーポン使用済み（redeemCoupon内で自動更新）

### Firestore 使用量の更新
- `incrementOCRUsage` / `incrementChatUsage` は **`increment(1)`** を使用（アトミック）
- getDoc → +1 → updateDoc パターンは**使わない**（競合状態の原因）

### 認証
- Google Sign-Inのみ（Email/Password認証なし）
- アカウント削除時は `reauthenticateWithCredential` が必要（`auth/requires-recent-login` エラー対策）
- `@react-native-google-signin/google-signin` は動的import（Expo Goでは利用不可）

### 決済 (Stripe)
- Cloud Functions経由でStripe APIを呼ぶ
- コイン購入: クライアントからPaymentIntent作成 → PaymentSheet表示 → Webhook(`payment_intent.succeeded`)でFirestore更新
- サブスク: クライアントからSubscription作成 → Webhook(`customer.subscription.created/updated/deleted`)でFirestore更新
- 解約: クライアント + Cloud Function + Webhook の三重でFirestore更新

## Cloud Functions (11関数)

HTTP関数 10個 + Firestoreトリガー 1個。すべて `us-central1` リージョン。

```
stripeCreateOrGetCustomer, stripeGetProducts, stripeCreateCoinPaymentIntent,
stripeCreateSubscription, stripeGetCurrentPlan, stripeRestorePurchases,
stripeCancelSubscription, stripeCreatePortalSession, stripeWebhook,
redeemCoupon, detectAbuseOnUserUpdate (Firestoreトリガー)
```

## よく使うコマンド

### ビルド確認（バンドルのみ）
```powershell
cd y:\project\syupee
npx expo export --platform ios 2>&1 | Select-Object -Last 6
```

### TypeScript チェック
```powershell
npx tsc --noEmit --pretty 2>&1 | Select-String "error TS"
```
※ tsconfig.json の `customConditions` エラーは既知（Expo由来、無視してOK）

### Cloud Functions ビルド & デプロイ
```powershell
cd y:\project\syupee\functions
npm run build 2>&1 | Select-Object -Last 10

cd y:\project\syupee
npx firebase-tools deploy --only functions,firestore:rules 2>&1 | Select-Object -Last 30
```
※ 初回Firestoreトリガー関数は Eventarc 権限伝播に時間がかかる場合あり → 数分後に再デプロイ

### EAS ビルド & 提出
```powershell
npx eas-cli build --platform ios --profile production --non-interactive
npx eas-cli submit --platform ios --profile production
```
※ ビルド前に `app.json` の `buildNumber` をインクリメントすること

### Firestore データ確認
```powershell
cd y:\project\syupee\functions
node -e "const admin=require('firebase-admin');admin.initializeApp({credential:admin.credential.cert(require('../syupee-ebfaa-firebase-adminsdk-fbsvc-9bc992ad1c.json'))});const db=admin.firestore();(async()=>{const snap=await db.doc('users/USER_UID').get();console.log(JSON.stringify(snap.data(),null,2));process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)})"
```
※ Admin SDKキー: `syupee-ebfaa-firebase-adminsdk-fbsvc-9bc992ad1c.json`（gitignore済み）
※ 古い `syupee-ebfaa-7c15a19bdf2d.json` は `revenuecat@` 用でFirestore権限なし

### Stripe データ確認
```powershell
cd y:\project\syupee\functions
node -e "require('dotenv').config();const Stripe=require('stripe');const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);(async()=>{const subs=await stripe.subscriptions.list({customer:'CUSTOMER_ID',limit:5});subs.data.forEach(s=>console.log(JSON.stringify({id:s.id,status:s.status,plan:s.metadata?.planKey},null,2)));process.exit(0)})()"
```

## セキュリティ

### Firestore ルール (`firestore.rules`)
- `users/{userId}` — 本人のみ読み書き可。書き込み制約あり:
  - `plan` は有効値のみ (`free`/`light`/`standard`/`premium`)
  - `ocrUsedThisMonth`/`chatUsedThisMonth` は減少不可
  - `coinBalance` は 0 以上
- `seasonStats` — 全認証ユーザー読み取り可、書き込みは本人のみ
- `abuseAlerts` — クライアントからアクセス不可（Cloud Functionsのみ）

### 不正利用検知 (`detectAbuseOnUserUpdate`)
- OCR/チャットがプラン上限の2倍超
- Freeプランで OCR 50回超 or チャット使用
- 1回の更新で使用量 +10 以上
- コイン残高マイナス

## 法的ページ

- `TermsScreen.tsx` — 利用規約（8条 + お問い合わせ）
- `PrivacyScreen.tsx` — プライバシーポリシー（7節 + お問い合わせ）
- 内部技術名（Firebase, SQLite, Azure Computer Vision API等）は記載しない
- AIサービスは OpenAI ではなく **Google Gemini** が正しい
- iOS/Apple固有の記載は避ける（Android展開の可能性）

## 過去のトラブルと教訓

| 問題 | 原因 | 解決 |
|------|------|------|
| Stripe価格とアプリ表示不一致 | PLANS定数の価格がStripe実額と異なっていた | Stripe APIで実価格を確認し定数を修正 |
| アカウント削除失敗 | `auth/requires-recent-login` | `reauthenticateWithCredential` でGoogle再認証後に削除 |
| 使用量カウンタの競合 | `getDoc → +1 → updateDoc` | `increment(1)` に変更 |
| Firestoreトリガーデプロイ失敗 | Eventarc Service Agent 権限未伝播 | 数分待って再デプロイ |
| Firestore直接アクセス不可 | 古いサービスアカウント(revenuecat@)にFirestore権限なし | Firebase Admin SDK用キーを新規取得 |
| 使用量表示がリセットされる | ローカルSQLiteのみ参照していた | Firestoreのuser値を優先するよう修正 |

## テスト用ユーザー

- UID: `30cP0IV8Y6YkveqZN5DvlfwKG5h1`
- Email: `tomoya1224smilebasic65@gmail.com`
- Stripe Customer: Firestoreの `stripeCustomerId` フィールドを参照

## 開発ルール

- **仕様追加・変更時は必ず `README.md` を更新すること**（機能追加、Cloud Functions追加、Firestoreコレクション追加、プラン変更など）
- README.md はプロジェクトの正式な仕様書として維持する

## 注意事項

- `src/services/openai.ts` は名前に反してGoogle Gemini APIを使用
- Expo Goではネイティブモジュール（Google Sign-In, expo-camera等）が動かない → Development Buildを使う
- Firestore接続は `experimentalForceLongPolling: true` が必要（React Native環境）
- `firebase/auth` は `metro.config.js` で CJS版に解決される設定あり

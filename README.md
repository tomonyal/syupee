# シュッピー - AI家計簿アプリ

撮るだけで節約相談！レシート撮影とAI対話で、プライバシーを守りながら確実に節約する家計簿アプリです。

## 技術スタック

- **フレームワーク**: React Native (Expo SDK 54)
- **データベース**: SQLite (ローカル) + Firestore (サーバー)
- **外部API**: Azure AI Vision (OCR), Google Gemini (AI)
- **認証**: Firebase Auth + Google Sign-In
- **決済**: Stripe (サブスクリプション + コイン購入)
- **バックエンド**: Firebase Cloud Functions (2nd Gen, Node.js 20)
- **状態管理**: Zustand

## プラン構成

| プラン | 月額 | OCR回数 | AI相談回数 |
|--------|------|---------|-----------|
| フリー | ¥0 | 0 | 0 |
| ライト | ¥300 | 30 | 10 |
| スタンダード | ¥600 | 100 | 50 |
| プレミアム | ¥1,200 | 300 | 500 |

## 不正利用検知

### Firestore セキュリティルール (`firestore.rules`)
- 使用量カウンタ（`ocrUsedThisMonth`, `chatUsedThisMonth`）の減少を禁止（クライアントからのリセット防止）
- `plan` フィールドは有効な値（`free`/`light`/`standard`/`premium`）のみ許可
- `coinBalance` は 0 以上を強制
- `abuseAlerts` コレクションはクライアントからアクセス不可

### Cloud Function (`detectAbuseOnUserUpdate`)
ユーザードキュメント更新時に自動実行され、以下を検知して `abuseAlerts` コレクションに記録：

| 検知パターン | 条件 |
|---|---|
| OCR/チャット枠超過 | プラン上限の2倍を超えた場合 |
| Freeプラン異常使用 | OCR 50回超 or チャット使用あり |
| 使用量の急増 | 1回の更新で+10以上 |
| コイン残高マイナス | `coinBalance < 0` |

### アトミックインクリメント
`incrementOCRUsage` / `incrementChatUsage` は Firestore の `increment()` を使用し、競合状態でのカウント巻き戻りを防止。

## データ構成

### Firestore（サーバー）
- `users/{uid}` — プラン、Stripe情報、使用量カウンタ、コイン残高、初回コインステータス、デバイスID
- `users/{uid}/coinTransactions/{txId}` — コイン取引履歴
- `coupons/{code}` — クーポンコード（coinAmount, used, usedBy, usedAt）
- `seasonStats/{uid}_{seasonId}` — シーズンスキャン統計
- `abuseAlerts/{alertId}` — 不正利用検知ログ

#### users ドキュメントのフィールド

| フィールド | 型 | 説明 |
|---|---|---|
| plan | string | `free`/`light`/`standard`/`premium` |
| ocrUsedThisMonth | number | 今月のOCR使用回数 |
| chatUsedThisMonth | number | 今月のAI相談使用回数 |
| ocrQuotaBalance | number | OCR追加購入枠の残高 |
| chatQuotaBalance | number | AI相談追加購入枠の残高 |
| coinBalance | number | コイン残高 |
| stripeCustomerId | string | Stripe顧客ID |
| stripeSubscriptionId | string | StripeサブスクID |
| initialCoinStatus | string | `none`/`requested`/`issued`/`redeemed` |
| initialCoinCouponCode | string | 発行された初回クーポンコード |
| deviceId | string | 端末固有ID（iOS: identifierForVendor） |

### SQLite（端末内）
- 支出データ、チャット履歴、予算設定、利用設定など

## クーポンコード発行手順

クーポンコードを発行して、ユーザーにコインを配布できます。

### 1. Firebaseコンソールでクーポンを作成

1. [Firebaseコンソール](https://console.firebase.google.com/project/syupee-ebfaa/firestore) を開く
2. Firestore → `coupons` コレクションを選択（初回は「コレクションを開始」で作成）
3. 「ドキュメントを追加」をクリック
4. ドキュメントID: **クーポンコード**（大文字英数字推奨、例: `SYUPEE2026`）
5. 以下のフィールドを追加:

| フィールド名 | 型 | 値 | 説明 |
|---|---|---|---|
| `coinAmount` | number | 例: `100` | 付与するコイン数 |
| `used` | boolean | `false` | 使用済みフラグ（必ず `false` で作成） |

### 2. ユーザーへの配布

クーポンコード（ドキュメントID）をユーザーに伝えます。ユーザーは **設定 → コインセクション → クーポンコード** から入力して受け取ります。

### 3. 使用後の状態

引き換え後、クーポンドキュメントは以下のように更新されます:

```json
{
  "coinAmount": 100,
  "used": true,
  "usedBy": "ユーザーUID",
  "usedAt": "2026-04-04T..."
}
```

> **注意**: 1つのクーポンコードは1回のみ使用可能です（1人限定）。複数人に配布する場合はコードを複数作成してください。

### CLI でのクーポン作成（一括発行）

```powershell
cd y:\project\syupee\functions
node -e "const admin=require('firebase-admin');admin.initializeApp({credential:admin.credential.cert(require('../syupee-ebfaa-firebase-adminsdk-fbsvc-9bc992ad1c.json'))});const db=admin.firestore();(async()=>{await db.doc('coupons/MYCODE123').set({coinAmount:100,used:false});console.log('Created');process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)})"
```

`MYCODE123` と `coinAmount` の値を変更して使用してください。

## 初回無料310コイン

新規ユーザーに310コインを配布する仕組みです。不正防止のため、手動承認フローを採用しています。

### フロー

1. **ユーザー**: ホーム画面の「初回無料310コイン」バナーをタップ → `initialCoinStatus: 'requested'` + `deviceId` がFirestoreに保存される
2. **管理者**: Firebaseコンソールで `users` コレクションを確認し、`initialCoinStatus: 'requested'` のユーザーを確認
   - `deviceId` が他ユーザーと重複していないか確認
   - `email` (Googleアカウント)が重複していないか確認
3. **管理者**: 問題なければ、下記の手順で承認:
   - `coupons` コレクションにクーポンを作成（例: `WELCOME_xxxxxx`, coinAmount: 310）
   - ユーザードキュメントの `initialCoinCouponCode` にクーポンコードを設定
   - ユーザードキュメントの `initialCoinStatus` を `'issued'` に変更
4. **ユーザー**: ホーム画面にクーポンコードが表示される → タップしてクーポン入力画面へ → コードを使用
5. **自動**: クーポン使用後、`initialCoinStatus` が `'redeemed'` に自動更新 → バナー非表示

### ステータス遷移

| ステータス | 意味 | ホーム画面表示 |
|---|---|---|
| `none` (未設定) | 未申請 | 「初回無料310コイン」ボタン |
| `requested` | 申請済み・審査中 | 「クーポンコード要求中」 |
| `issued` | クーポン発行済み | クーポンコード表示 + 「タップして使う」 |
| `redeemed` | 適用済み | 表示なし |

### CLI で承認する場合

```powershell
cd y:\project\syupee\functions
node -e "const admin=require('firebase-admin');admin.initializeApp({credential:admin.credential.cert(require('../syupee-ebfaa-firebase-adminsdk-fbsvc-9bc992ad1c.json'))});const db=admin.firestore();(async()=>{const code='WELCOME_USER1';await db.doc('coupons/'+code).set({coinAmount:310,used:false});await db.doc('users/TARGET_UID').update({initialCoinStatus:'issued',initialCoinCouponCode:code});console.log('Issued:',code);process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)})"
```

`WELCOME_USER1` と `TARGET_UID` を適宜変更してください。

### 確認用クエリ（要求中ユーザー一覧）

```powershell
cd y:\project\syupee\functions
node -e "const admin=require('firebase-admin');admin.initializeApp({credential:admin.credential.cert(require('../syupee-ebfaa-firebase-adminsdk-fbsvc-9bc992ad1c.json'))});const db=admin.firestore();(async()=>{const snap=await db.collection('users').where('initialCoinStatus','==','requested').get();snap.forEach(d=>{const u=d.data();console.log(d.id,u.deviceId,u.plan)});process.exit(0)})().catch(e=>{console.error(e.message);process.exit(1)})"
```

## Cloud Functions (11関数)

| 関数名 | 種別 | 用途 |
|--------|------|------|
| `stripeCreateOrGetCustomer` | HTTP | Stripe顧客の作成/取得 |
| `stripeGetProducts` | HTTP | 商品一覧取得 |
| `stripeCreateCoinPaymentIntent` | HTTP | コイン購入の決済Intent作成 |
| `stripeCreateSubscription` | HTTP | サブスクリプション作成 |
| `stripeGetCurrentPlan` | HTTP | 現在のプラン取得 |
| `stripeRestorePurchases` | HTTP | 購入復元 |
| `stripeCancelSubscription` | HTTP | サブスクリプション解約 |
| `stripeCreatePortalSession` | HTTP | Stripeカスタマーポータル |
| `stripeWebhook` | HTTP | Stripe Webhook処理 |
| `redeemCoupon` | HTTP | クーポンコード引き換え |
| `detectAbuseOnUserUpdate` | Firestore トリガー | 不正利用検知 |

## セットアップ

```bash
npm install
npx expo start
```

## 環境変数

`.env` ファイルを作成し、以下を設定してください：

```
AZURE_VISION_ENDPOINT=your_azure_endpoint
AZURE_VISION_KEY=your_azure_key
GEMINI_API_KEY=your_gemini_key
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
```

Cloud Functions (`functions/.env`):
```
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

## デプロイ

```bash
# Cloud Functions + Firestore ルール
npx firebase-tools deploy --only functions,firestore:rules

# アプリビルド (iOS)
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

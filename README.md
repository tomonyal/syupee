# シュッピー - AI家計簿アプリ

撮るだけで節約相談！レシート撮影とAI対話で、プライバシーを守りながら確実に節約する家計簿アプリです。

## 技術スタック

- **フレームワーク**: React Native (Expo SDK 54)
- **データベース**: SQLite (ローカル) + Firestore (サーバー)
- **外部API**: Azure AI Vision (OCR), Google Gemini (AI)
- **認証**: Firebase Auth + Google Sign-In + Sign in with Apple
- **決済**: Apple In-App Purchase (サブスクリプション + コイン購入)
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
- `users/{uid}` — プラン、Apple IAP情報、使用量カウンタ、コイン残高
- `users/{uid}/coinTransactions/{txId}` — コイン取引履歴
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
| appleOriginalTransactionId | string | Apple IAPトランザクションID |
| appleSubscriptionExpiresAt | string | Appleサブスク有効期限 |

### SQLite（端末内）
- 支出データ、チャット履歴、予算設定、利用設定など

## Cloud Functions (6関数)

| 関数名 | 種別 | 用途 |
|--------|------|------|
| `validateAppleReceipt` | HTTP | Apple IAPレシート検証 & コイン/プラン付与 |
| `getCurrentPlan` | HTTP | 現在のプラン取得 |
| `restoreApplePurchases` | HTTP | 購入復元 |
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
APPLE_SHARED_SECRET=your_apple_shared_secret
```

## デプロイ

```bash
# Cloud Functions + Firestore ルール
npx firebase-tools deploy --only functions,firestore:rules

# アプリビルド (iOS)
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

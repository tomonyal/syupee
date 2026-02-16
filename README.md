# シュッピくん - AI家計簿アプリ

撮るだけで節約相談！レシート撮影とAI対話で、プライバシーを守りながら確実に節約する家計簿アプリです。

## 技術スタック

- **フレームワーク**: React Native (Expo)
- **データベース**: SQLite (ローカル)
- **外部API**: Azure AI Vision (OCR), OpenAI GPT-4o mini
- **認証**: Firebase + Google Sign-In
- **状態管理**: Zustand

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
OPENAI_API_KEY=your_openai_key
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
FIREBASE_PROJECT_ID=your_firebase_project_id
GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
```

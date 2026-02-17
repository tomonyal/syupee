// Firebase設定
// プロジェクトルートの.envファイルにEXPO_PUBLIC_プレフィックス付きで設定してください
export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const AZURE_CONFIG = {
  endpoint: process.env.EXPO_PUBLIC_AZURE_VISION_ENDPOINT || '',
  apiKey: process.env.EXPO_PUBLIC_AZURE_VISION_KEY || '',
};

export const GEMINI_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  model: 'gemini-2.0-flash',
};

export const GOOGLE_CONFIG = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
};

export const REVENUECAT_CONFIG = {
  apiKeyIOS: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '',
  apiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '',
};

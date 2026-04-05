/**
 * Stripe購入フロー テストスクリプト
 * ビルドせずにCloud Functions + Stripe連携を検証する
 *
 * 使い方: node test-stripe-flow.js
 */

const admin = require('./functions/node_modules/firebase-admin');
const https = require('https');

// === 設定 ===
const SERVICE_ACCOUNT_PATH = './syupee-ebfaa-7c15a19bdf2d.json';
const FIREBASE_API_KEY = 'AIzaSyDS_Sr5Z9j93IUqRWsYAQ7EM6aYeGcEWN4';
const API_BASE_URL = 'https://us-central1-syupee-ebfaa.cloudfunctions.net';

// テスト用ユーザーID（実際にログインしたユーザーのUIDを使う場合はここを変更）
const TEST_USER_ID = 'test-stripe-user-001';

// === Firebase Admin 初期化 ===
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// === HTTPリクエストヘルパー ===
function postRequest(url, body, authToken) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const data = JSON.stringify(body);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// === Firebase IDトークン取得（REST API経由） ===
async function getIdToken(customToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    });

    const options = {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.idToken) {
            resolve(parsed.idToken);
          } else {
            reject(new Error('IDトークン取得失敗: ' + JSON.stringify(parsed)));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// === メインテスト ===
async function main() {
  console.log('==========================================');
  console.log('  Stripe購入フロー テスト');
  console.log('==========================================\n');

  // Step 1: カスタムトークン作成
  console.log('[1/6] Firebase カスタムトークン作成...');
  let customToken;
  try {
    customToken = await admin.auth().createCustomToken(TEST_USER_ID);
    console.log('  ✅ カスタムトークン作成成功');
  } catch (e) {
    console.error('  ❌ カスタムトークン作成失敗:', e.message);
    process.exit(1);
  }

  // Step 2: IDトークンに交換
  console.log('[2/6] Firebase IDトークン取得...');
  let idToken;
  try {
    idToken = await getIdToken(customToken);
    console.log('  ✅ IDトークン取得成功 (長さ:', idToken.length, ')');
  } catch (e) {
    console.error('  ❌ IDトークン取得失敗:', e.message);
    process.exit(1);
  }

  // Step 3: stripeCreateOrGetCustomer
  console.log('[3/6] stripeCreateOrGetCustomer 呼び出し...');
  try {
    const res = await postRequest(
      `${API_BASE_URL}/stripeCreateOrGetCustomer`,
      { userId: TEST_USER_ID },
      idToken
    );
    console.log('  ステータス:', res.status);
    console.log('  レスポンス:', JSON.stringify(res.data, null, 2));
    if (res.status === 200 && res.data.customerId) {
      console.log('  ✅ Stripe Customer作成/取得成功:', res.data.customerId);
    } else {
      console.log('  ❌ 失敗');
    }
  } catch (e) {
    console.error('  ❌ エラー:', e.message);
  }

  // Step 4: stripeGetProducts
  console.log('[4/6] stripeGetProducts 呼び出し...');
  try {
    const res = await postRequest(
      `${API_BASE_URL}/stripeGetProducts`,
      {},
      idToken
    );
    console.log('  ステータス:', res.status);
    if (res.status === 200) {
      console.log('  コインパッケージ数:', res.data.coinProducts?.length || 0);
      console.log('  プラン数:', res.data.planProducts?.length || 0);
      if (res.data.coinProducts?.length > 0) {
        console.log('  コイン例:', JSON.stringify(res.data.coinProducts[0]));
      }
      if (res.data.planProducts?.length > 0) {
        console.log('  プラン例:', JSON.stringify(res.data.planProducts[0]));
      }
      console.log('  ✅ 商品一覧取得成功');
    } else {
      console.log('  ❌ 失敗:', JSON.stringify(res.data));
    }
  } catch (e) {
    console.error('  ❌ エラー:', e.message);
  }

  // Step 5: stripeCreateCoinPaymentIntent (coin_50 をテスト)
  console.log('[5/6] stripeCreateCoinPaymentIntent (coin_50) 呼び出し...');
  try {
    const res = await postRequest(
      `${API_BASE_URL}/stripeCreateCoinPaymentIntent`,
      { packageId: 'coin_50', priceId: 'price_1TCqQeQLTQl0iplLMyV8xhCe' },
      idToken
    );
    console.log('  ステータス:', res.status);
    if (res.status === 200) {
      console.log('  paymentIntent:', res.data.paymentIntent ? '✅ client_secret取得済み' : '❌ なし');
      console.log('  ephemeralKey:', res.data.ephemeralKey ? '✅ あり' : '❌ なし');
      console.log('  customer:', res.data.customer || '❌ なし');
      if (res.data.paymentIntent && res.data.ephemeralKey && res.data.customer) {
        console.log('  ✅ PaymentIntent作成成功 - PaymentSheet表示可能！');
      }
    } else {
      console.log('  ❌ 失敗:', JSON.stringify(res.data));
    }
  } catch (e) {
    console.error('  ❌ エラー:', e.message);
  }

  // Step 6: stripeCreateSubscription (light プランをテスト)
  console.log('[6/6] stripeCreateSubscription (light) 呼び出し...');
  try {
    const res = await postRequest(
      `${API_BASE_URL}/stripeCreateSubscription`,
      { priceId: 'price_1TCqIMQLTQl0iplLj5prm8Rl', planKey: 'light' },
      idToken
    );
    console.log('  ステータス:', res.status);
    if (res.status === 200) {
      console.log('  paymentIntent:', res.data.paymentIntent ? '✅ client_secret取得済み' : '❌ なし');
      console.log('  ephemeralKey:', res.data.ephemeralKey ? '✅ あり' : '❌ なし');
      console.log('  customer:', res.data.customer || '❌ なし');
      console.log('  subscriptionId:', res.data.subscriptionId || '❌ なし');
      if (res.data.paymentIntent && res.data.ephemeralKey && res.data.customer) {
        console.log('  ✅ Subscription作成成功 - PaymentSheet表示可能！');
      }
    } else {
      console.log('  ❌ 失敗:', JSON.stringify(res.data));
    }
  } catch (e) {
    console.error('  ❌ エラー:', e.message);
  }

  console.log('\n==========================================');
  console.log('  テスト完了');
  console.log('==========================================');

  // クリーンアップ
  admin.app().delete();
}

main().catch(console.error);

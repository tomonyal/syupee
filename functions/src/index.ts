import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import cors from 'cors';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

admin.initializeApp();

// ============================
// Stripe初期化（遅延）
// ============================
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    _stripe = new Stripe(key, {
      apiVersion: '2025-02-24.acacia',
    });
  }
  return _stripe;
}

const corsHandler = cors({ origin: true });

// ============================
// コインパッケージ定義（クライアントと一致させる）
// ============================
const COIN_PACKAGES: Record<string, { coins: number; price: number; label: string; priceId: string }> = {
  coin_50: { coins: 50, price: 120, label: 'otameshi', priceId: 'price_1TIfAVKg4AmrK7u5zRiSDp5U' },
  coin_100: { coins: 100, price: 200, label: 'otoku', priceId: 'price_1TIfAXKg4AmrK7u5QP4UhlRU' },
  coin_300: { coins: 300, price: 500, label: 'tappuri', priceId: 'price_1TIfAXKg4AmrK7u5yboMuEVD' },
  coin_500: { coins: 500, price: 700, label: 'mega', priceId: 'price_1TIfAVKg4AmrK7u5JrJ1M14N' },
  coin_1000: { coins: 1000, price: 1200, label: 'premium', priceId: 'price_1TIfATKg4AmrK7u547JR6bNN' },
};

// プラン定義
const PLANS: Record<string, { label: string; price: number; priceId: string }> = {
  light: { label: 'Light', price: 300, priceId: 'price_1TIfATKg4AmrK7u5aCWTB0KN' },
  standard: { label: 'Standard', price: 600, priceId: 'price_1TIfAUKg4AmrK7u5q7exGdbq' },
  premium: { label: 'Premium', price: 1200, priceId: 'price_1TIfAXKg4AmrK7u5h9wEYXh2' },
};

// ============================
// 認証ミドルウェア
// ============================
async function verifyAuth(req: functions.https.Request): Promise<admin.auth.DecodedIdToken> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new functions.https.HttpsError('unauthenticated', 'No auth token');
  }
  const token = authHeader.split('Bearer ')[1];
  return admin.auth().verifyIdToken(token);
}

// Firestoreからユーザーの stripeCustomerId を取得/設定するヘルパー
async function getOrCreateStripeCustomer(
  userId: string,
  email?: string,
  displayName?: string
): Promise<string> {
  const userDoc = await admin.firestore().doc(`users/${userId}`).get();
  const data = userDoc.data();

  if (data?.stripeCustomerId) {
    return data.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
    email: email || undefined,
    name: displayName || undefined,
    metadata: { firebaseUID: userId },
  });

  await admin.firestore().doc(`users/${userId}`).set(
    { stripeCustomerId: customer.id },
    { merge: true }
  );

  return customer.id;
}

// ============================
// 1. Stripe Customer作成/取得
// ============================
export const stripeCreateOrGetCustomer = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const customerId = await getOrCreateStripeCustomer(
        decoded.uid,
        decoded.email,
        decoded.name
      );
      res.json({ customerId });
    } catch (error: any) {
      console.error('createOrGetCustomer error:', error);
      res.status(error.code === 'unauthenticated' ? 401 : 500).json({
        message: error.message || 'Customer creation failed',
      });
    }
  });
});

// ============================
// 2. 商品一覧取得
// ============================
export const stripeGetProducts = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      await verifyAuth(req);

      const coinProducts = Object.entries(COIN_PACKAGES).map(([id, pkg]) => ({
        packageId: id,
        priceId: pkg.priceId,
        localizedPrice: `\u00a5${pkg.price}`,
        price: pkg.price,
        currencyCode: 'JPY',
        label: pkg.label,
        coins: pkg.coins,
      }));

      const planProducts = Object.entries(PLANS).map(([key, plan]) => ({
        planKey: key,
        priceId: plan.priceId,
        localizedPrice: `\u00a5${plan.price}`,
        price: plan.price,
        currencyCode: 'JPY',
        label: plan.label,
      }));

      res.json({ coinProducts, planProducts });
    } catch (error: any) {
      console.error('getProducts error:', error);
      res.status(500).json({ message: error.message || 'Failed to get products' });
    }
  });
});

// ============================
// 3. コイン購入 PaymentIntent作成
// ============================
export const stripeCreateCoinPaymentIntent = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const { packageId } = req.body;

      const coinPkg = COIN_PACKAGES[packageId];
      if (!coinPkg) {
        res.status(400).json({ message: 'Invalid package ID' });
        return;
      }

      const customerId = await getOrCreateStripeCustomer(decoded.uid, decoded.email);

      const ephemeralKey = await getStripe().ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2025-02-24.acacia' }
      );

      const paymentIntent = await getStripe().paymentIntents.create({
        amount: coinPkg.price,
        currency: 'jpy',
        customer: customerId,
        metadata: {
          type: 'coin_purchase',
          packageId,
          coins: String(coinPkg.coins),
          userId: decoded.uid,
        },
        automatic_payment_methods: { enabled: true },
      });

      res.json({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
      });
    } catch (error: any) {
      console.error('createCoinPaymentIntent error:', error);
      res.status(500).json({ message: error.message || 'PaymentIntent creation failed' });
    }
  });
});

// ============================
// 4. サブスクリプション作成
// ============================
export const stripeCreateSubscription = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const { priceId, planKey } = req.body;

      if (!PLANS[planKey]) {
        res.status(400).json({ message: 'Invalid plan' });
        return;
      }

      const customerId = await getOrCreateStripeCustomer(decoded.uid, decoded.email);

      // 既存のサブスクリプションがあればキャンセル
      const existingSubs = await getStripe().subscriptions.list({
        customer: customerId,
        status: 'active',
      });

      for (const sub of existingSubs.data) {
        await getStripe().subscriptions.cancel(sub.id);
      }

      // 新しいサブスクリプション作成
      const subscription = await getStripe().subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          planKey,
          userId: decoded.uid,
        },
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const pi = invoice.payment_intent as Stripe.PaymentIntent;

      if (!pi || !pi.client_secret) {
        // サブスクリプションが即時アクティブ（無料プラン等）の場合
        const ephemeralKey = await getStripe().ephemeralKeys.create(
          { customer: customerId },
          { apiVersion: '2025-02-24.acacia' }
        );
        // プランをFirestoreに直接設定
        await admin.firestore().doc(`users/${decoded.uid}`).set(
          { plan: planKey, stripeSubscriptionId: subscription.id },
          { merge: true }
        );
        res.json({
          paymentIntent: null,
          ephemeralKey: ephemeralKey.secret,
          customer: customerId,
          subscriptionId: subscription.id,
          activated: true,
        });
        return;
      }

      const ephemeralKey = await getStripe().ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2025-02-24.acacia' }
      );

      res.json({
        paymentIntent: pi.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customerId,
        subscriptionId: subscription.id,
      });
    } catch (error: any) {
      console.error('createSubscription error:', error);
      res.status(500).json({ message: error.message || 'Subscription creation failed' });
    }
  });
});

// ============================
// 5. 現在のプラン取得
// ============================
export const stripeGetCurrentPlan = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const customerId = await getOrCreateStripeCustomer(decoded.uid, decoded.email);

      const subscriptions = await getStripe().subscriptions.list({
        customer: customerId,
        status: 'active',
        expand: ['data.items.data.price'],
      });

      if (subscriptions.data.length === 0) {
        res.json({ plan: 'free' });
        return;
      }

      const latestSub = subscriptions.data[0];
      const planKey = latestSub.metadata.planKey || 'free';
      res.json({ plan: planKey });
    } catch (error: any) {
      console.error('getCurrentPlan error:', error);
      res.status(500).json({ message: error.message || 'Failed to get plan' });
    }
  });
});

// ============================
// 6. 購入復元
// ============================
export const stripeRestorePurchases = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const customerId = await getOrCreateStripeCustomer(decoded.uid, decoded.email);

      const subscriptions = await getStripe().subscriptions.list({
        customer: customerId,
        status: 'active',
      });

      if (subscriptions.data.length === 0) {
        res.json({ plan: 'free' });
        return;
      }

      const planKey = subscriptions.data[0].metadata.planKey || 'free';

      await admin.firestore().doc(`users/${decoded.uid}`).set(
        { plan: planKey },
        { merge: true }
      );

      res.json({ plan: planKey });
    } catch (error: any) {
      console.error('restorePurchases error:', error);
      res.status(500).json({ message: error.message || 'Restore failed' });
    }
  });
});

// ============================
// 7. サブスクリプションキャンセル
// ============================
export const stripeCancelSubscription = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const customerId = await getOrCreateStripeCustomer(decoded.uid, decoded.email);

      const subscriptions = await getStripe().subscriptions.list({
        customer: customerId,
        status: 'active',
      });

      for (const sub of subscriptions.data) {
        await getStripe().subscriptions.cancel(sub.id);
      }

      await admin.firestore().doc(`users/${decoded.uid}`).set(
        { plan: 'free' },
        { merge: true }
      );

      res.json({ success: true });
    } catch (error: any) {
      console.error('cancelSubscription error:', error);
      res.status(500).json({ message: error.message || 'Cancel failed' });
    }
  });
});

// ============================
// 8. Customer Portal セッション作成
// ============================
export const stripeCreatePortalSession = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const customerId = await getOrCreateStripeCustomer(decoded.uid, decoded.email);

      const session = await getStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: req.body.returnUrl || 'https://syupee-ebfaa.web.app',
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('createPortalSession error:', error);
      res.status(500).json({ message: error.message || 'Portal session creation failed' });
    }
  });
});

// ============================
// 9. Webhook（Stripeからのイベント受信）
// ============================
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata.type === 'coin_purchase') {
          const userId = pi.metadata.userId;
          const coins = parseInt(pi.metadata.coins || '0', 10);
          const packageId = pi.metadata.packageId;

          if (userId && coins > 0) {
            await admin.firestore().collection(`users/${userId}/coinTransactions`).add({
              type: 'purchase',
              amount: coins,
              description: `Coin purchase (${packageId})`,
              paymentIntentId: pi.id,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await admin.firestore().doc(`users/${userId}`).set(
              {
                coinBalance: admin.firestore.FieldValue.increment(coins),
              },
              { merge: true }
            );

            console.log(`Coins granted: userId=${userId}, coins=${coins}`);
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.userId;
        const planKey = sub.metadata.planKey;

        if (userId && planKey && sub.status === 'active') {
          await admin.firestore().doc(`users/${userId}`).set(
            { plan: planKey, stripeSubscriptionId: sub.id },
            { merge: true }
          );
          console.log(`Plan updated: userId=${userId}, plan=${planKey}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.userId;

        if (userId) {
          await admin.firestore().doc(`users/${userId}`).set(
            { plan: 'free', stripeSubscriptionId: null },
            { merge: true }
          );
          console.log(`Plan cancelled: userId=${userId} -> free`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const userSnapshot = await admin.firestore()
          .collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userId = userSnapshot.docs[0].id;
          console.warn(`Payment failed: userId=${userId}, invoiceId=${invoice.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================
// クーポンコード引き換え
// ============================
export const redeemCoupon = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    try {
      const decoded = await verifyAuth(req);
      const userId = decoded.uid;
      const { code } = req.body;

      if (!code || typeof code !== 'string' || code.trim().length === 0) {
        res.status(400).json({ error: 'クーポンコードを入力してください' });
        return;
      }

      const couponCode = code.trim().toUpperCase();
      const couponRef = admin.firestore().doc(`coupons/${couponCode}`);

      // トランザクションでアトミックに処理
      const result = await admin.firestore().runTransaction(async (tx) => {
        const couponSnap = await tx.get(couponRef);
        const userRef = admin.firestore().doc(`users/${userId}`);
        const userSnap = await tx.get(userRef);

        if (!couponSnap.exists) {
          throw new Error('無効なクーポンコードです');
        }

        const couponData = couponSnap.data()!;

        if (couponData.used) {
          throw new Error('このクーポンコードは使用済みです');
        }

        const coinAmount = couponData.coinAmount as number;
        if (!coinAmount || coinAmount <= 0) {
          throw new Error('無効なクーポンです');
        }

        // クーポンを使用済みにする
        tx.update(couponRef, {
          used: true,
          usedBy: userId,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // ユーザーのコイン残高を増やす
        const userUpdate: Record<string, any> = {
          coinBalance: admin.firestore.FieldValue.increment(coinAmount),
        };

        // 初回コインクーポンの場合は適用済みに更新
        const userData = userSnap.data();
        if (userData?.initialCoinCouponCode === couponCode) {
          userUpdate.initialCoinStatus = 'redeemed';
        }

        tx.update(userRef, userUpdate);

        // コイン取引履歴に記録
        const txRef = admin.firestore().collection(`users/${userId}/coinTransactions`).doc();
        tx.set(txRef, {
          type: 'bonus',
          amount: coinAmount,
          description: `クーポン: ${couponCode}`,
          createdAt: new Date().toISOString(),
        });

        return { coinAmount, code: couponCode };
      });

      res.json({
        success: true,
        coinAmount: result.coinAmount,
        message: `${result.coinAmount}コインを獲得しました！`,
      });
    } catch (error: any) {
      console.error('redeemCoupon error:', error);
      const message = error.message || 'クーポンの引き換えに失敗しました';
      res.status(400).json({ error: message });
    }
  });
});

// ============================
// 不正利用検知（Firestore トリガー）
// ============================
const PLAN_LIMITS: Record<string, { ocrLimit: number; chatLimit: number }> = {
  free: { ocrLimit: 0, chatLimit: 0 },
  light: { ocrLimit: 30, chatLimit: 10 },
  standard: { ocrLimit: 100, chatLimit: 50 },
  premium: { ocrLimit: 300, chatLimit: 500 },
};

export const detectAbuseOnUserUpdate = onDocumentUpdated(
  { document: 'users/{userId}', region: 'us-central1' },
  async (event) => {
    if (!event.data) return;
    const userId = event.params.userId;
    const before = event.data.before.data();
    const after = event.data.after.data();

    const plan = (after.plan || 'free') as string;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    const ocrUsed = after.ocrUsedThisMonth || 0;
    const chatUsed = after.chatUsedThisMonth || 0;

    const alerts: string[] = [];

    // OCR枠超過検知（コイン/追加枠での利用分を考慮して2倍まで許容）
    if (ocrUsed > limits.ocrLimit * 2 && limits.ocrLimit > 0) {
      alerts.push(`OCR使用量超過: ${ocrUsed}/${limits.ocrLimit} (${plan}プラン)`);
    }

    // チャット枠超過検知
    if (chatUsed > limits.chatLimit * 2 && limits.chatLimit > 0) {
      alerts.push(`チャット使用量超過: ${chatUsed}/${limits.chatLimit} (${plan}プラン)`);
    }

    // Freeプランで使用がある場合（コイン経由以外は不正の可能性）
    if (plan === 'free') {
      if (ocrUsed > 50) {
        alerts.push(`Freeプランで異常なOCR使用: ${ocrUsed}回`);
      }
      if (chatUsed > 0) {
        alerts.push(`Freeプランでチャット使用: ${chatUsed}回`);
      }
    }

    // 急激な増加検知（1回の更新で10以上増加）
    const ocrDelta = ocrUsed - (before.ocrUsedThisMonth || 0);
    const chatDelta = chatUsed - (before.chatUsedThisMonth || 0);
    if (ocrDelta > 10) {
      alerts.push(`OCR使用量の急増: +${ocrDelta}（${before.ocrUsedThisMonth || 0} → ${ocrUsed}）`);
    }
    if (chatDelta > 10) {
      alerts.push(`チャット使用量の急増: +${chatDelta}（${before.chatUsedThisMonth || 0} → ${chatUsed}）`);
    }

    // コイン残高がマイナスになった場合
    if ((after.coinBalance || 0) < 0) {
      alerts.push(`コイン残高がマイナス: ${after.coinBalance}`);
    }

    if (alerts.length > 0) {
      await admin.firestore().collection('abuseAlerts').add({
        userId,
        plan,
        alerts,
        ocrUsed,
        chatUsed,
        coinBalance: after.coinBalance || 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.warn(`[ABUSE] userId=${userId}:`, alerts.join(', '));
    }
  }
);

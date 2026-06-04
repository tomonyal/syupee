"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetMonthlyUsageIfNeeded = exports.detectAbuseOnUserUpdate = exports.restoreApplePurchases = exports.getCurrentPlan = exports.validateAppleReceipt = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
admin.initializeApp();
const corsHandler = (0, cors_1.default)({ origin: true });
// ============================
// Apple IAP Product → コインマッピング
// ============================
const COIN_PRODUCTS = {
    'com.syupee.coin.100': { coins: 100, label: 'おためし' },
    'com.syupee.coin.300': { coins: 300, label: 'お得パック' },
    'com.syupee.coin.500': { coins: 500, label: 'たっぷりパック' },
    'com.syupee.coin.1000': { coins: 1000, label: 'プレミアムパック' },
};
// Apple IAP Product → プランマッピング
const PLAN_PRODUCTS = {
    'com.syupee.sub.light': 'light',
    'com.syupee.sub.standard': 'standard',
    'com.syupee.sub.premium': 'premium',
};
// Apple App Store サーバーURL
const APPLE_VERIFY_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
// ============================
// 認証ミドルウェア
// ============================
async function verifyAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        throw new functions.https.HttpsError('unauthenticated', 'No auth token');
    }
    const token = authHeader.split('Bearer ')[1];
    return admin.auth().verifyIdToken(token);
}
const appleSharedSecret = (0, params_1.defineSecret)('APPLE_SHARED_SECRET');
// ============================
// Apple レシート検証ヘルパー
// ============================
async function verifyAppleReceipt(receiptData) {
    const sharedSecret = appleSharedSecret.value();
    const body = JSON.stringify({
        'receipt-data': receiptData,
        password: sharedSecret,
        'exclude-old-transactions': true,
    });
    // まず本番サーバーで検証
    let response = await fetch(APPLE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    });
    let result = await response.json();
    // status 21007 = sandbox receipt → sandboxサーバーで再検証
    if (result.status === 21007) {
        response = await fetch(APPLE_SANDBOX_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        result = await response.json();
    }
    return result;
}
// ============================
// 1. Apple 購入検証 & 付与 (StoreKit 2 transactionId ベース)
// ============================
exports.validateAppleReceipt = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        const decoded = await verifyAuth(req);
        const userId = decoded.uid;
        const { transactionId, productId, packageId, planKey, type } = req.body;
        if (!transactionId || !productId) {
            res.status(400).json({ success: false, message: 'Missing transactionId or productId' });
            return;
        }
        if (type === 'coin') {
            // コイン購入の処理
            const coinProduct = COIN_PRODUCTS[productId];
            if (!coinProduct) {
                res.status(400).json({ success: false, message: 'Invalid product ID' });
                return;
            }
            // 重複付与防止: transactionId で確認
            const existingTx = await admin.firestore()
                .collection(`users/${userId}/coinTransactions`)
                .where('appleTransactionId', '==', transactionId)
                .limit(1)
                .get();
            if (!existingTx.empty) {
                // 既に付与済み
                res.json({ success: true, message: 'Already processed' });
                return;
            }
            // コイン付与
            await admin.firestore().collection(`users/${userId}/coinTransactions`).add({
                type: 'purchase',
                amount: coinProduct.coins,
                description: `コイン購入 (${coinProduct.label})`,
                appleTransactionId: transactionId,
                productId,
                createdAt: new Date().toISOString(),
            });
            await admin.firestore().doc(`users/${userId}`).set({ coinBalance: admin.firestore.FieldValue.increment(coinProduct.coins) }, { merge: true });
            console.log(`Coins granted: userId=${userId}, coins=${coinProduct.coins}, txId=${transactionId}`);
            res.json({ success: true, coins: coinProduct.coins });
        }
        else if (type === 'subscription') {
            // サブスクリプションの処理
            const plan = PLAN_PRODUCTS[productId] || planKey;
            if (!plan || plan === 'free') {
                res.status(400).json({ success: false, message: 'Invalid plan' });
                return;
            }
            await admin.firestore().doc(`users/${userId}`).set({
                plan,
                appleOriginalTransactionId: transactionId,
            }, { merge: true });
            console.log(`Plan activated: userId=${userId}, plan=${plan}, txId=${transactionId}`);
            res.json({ success: true, plan });
        }
        else {
            res.status(400).json({ success: false, message: 'Invalid purchase type' });
        }
    }
    catch (error) {
        console.error('validateAppleReceipt error:', error);
        res.status(500).json({ success: false, message: error.message || 'Validation failed' });
    }
});
// ============================
// 2. 現在のプラン取得 & Apple側サブスク状態の同期
// ============================
exports.getCurrentPlan = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        try {
            const decoded = await verifyAuth(req);
            const userId = decoded.uid;
            const { applePlan, transactionId, productId } = req.body || {};
            const userDoc = await admin.firestore().doc(`users/${userId}`).get();
            const data = userDoc.data();
            let plan = data?.plan || 'free';
            // クライアントからApple側のサブスク状態が送られた場合、同期する
            if (applePlan !== undefined) {
                const validPlans = ['free', 'light', 'standard', 'premium'];
                if (validPlans.includes(applePlan)) {
                    if (applePlan !== 'free' && applePlan !== plan) {
                        // Apple側にアクティブなサブスクがある → プランを更新
                        await admin.firestore().doc(`users/${userId}`).set({
                            plan: applePlan,
                            appleOriginalTransactionId: transactionId || '',
                        }, { merge: true });
                        plan = applePlan;
                        console.log(`[Subscription] Synced plan from Apple: userId=${userId}, plan=${plan}`);
                    }
                    else if (applePlan === 'free' && plan !== 'free') {
                        // Apple側にサブスクがない → freeにダウングレード
                        await admin.firestore().doc(`users/${userId}`).set({ plan: 'free' }, { merge: true });
                        plan = 'free';
                        console.log(`[Subscription] Downgraded (no Apple sub): userId=${userId}`);
                    }
                }
            }
            res.json({ plan });
        }
        catch (error) {
            console.error('getCurrentPlan error:', error);
            res.status(500).json({ message: error.message || 'Failed to get plan' });
        }
    });
});
// ============================
// 3. 購入復元
// ============================
exports.restoreApplePurchases = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        const decoded = await verifyAuth(req);
        const userId = decoded.uid;
        const { purchases } = req.body;
        let activePlan = 'free';
        let latestTransactionId = '';
        if (purchases && Array.isArray(purchases)) {
            // 複数サブスクがある場合、transactionIdが最大（最新）のものを採用
            let latestTxNum = 0;
            for (const purchase of purchases) {
                const plan = PLAN_PRODUCTS[purchase.productId];
                if (plan) {
                    const txNum = parseInt(purchase.transactionId || '0', 10) || 0;
                    if (txNum >= latestTxNum) {
                        latestTxNum = txNum;
                        activePlan = plan;
                        latestTransactionId = purchase.transactionId || '';
                    }
                }
            }
            if (activePlan !== 'free') {
                await admin.firestore().doc(`users/${userId}`).set({
                    plan: activePlan,
                    appleOriginalTransactionId: latestTransactionId,
                }, { merge: true });
            }
        }
        if (activePlan === 'free') {
            await admin.firestore().doc(`users/${userId}`).set({ plan: 'free' }, { merge: true });
        }
        res.json({ plan: activePlan });
    }
    catch (error) {
        console.error('restoreApplePurchases error:', error);
        res.status(500).json({ message: error.message || 'Restore failed' });
    }
});
// ============================
// 不正利用検知（Firestore トリガー）
// ============================
const PLAN_LIMITS = {
    free: { ocrLimit: 0, chatLimit: 0 },
    light: { ocrLimit: 30, chatLimit: 10 },
    standard: { ocrLimit: 100, chatLimit: 50 },
    premium: { ocrLimit: 300, chatLimit: 500 },
};
exports.detectAbuseOnUserUpdate = (0, firestore_1.onDocumentUpdated)({ document: 'users/{userId}', region: 'us-central1' }, async (event) => {
    if (!event.data)
        return;
    const userId = event.params.userId;
    const before = event.data.before.data();
    const after = event.data.after.data();
    const plan = (after.plan || 'free');
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const ocrUsed = after.ocrUsedThisMonth || 0;
    const chatUsed = after.chatUsedThisMonth || 0;
    const alerts = [];
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
});
// ============================
// 月次リセット（Admin SDKでルール無視して更新）
// ============================
exports.resetMonthlyUsageIfNeeded = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            const decoded = await verifyAuth(req);
            const userId = decoded.uid;
            const userRef = admin.firestore().collection('users').doc(userId);
            const userSnap = await userRef.get();
            if (!userSnap.exists) {
                res.status(404).json({ success: false, message: 'User not found' });
                return;
            }
            const userData = userSnap.data();
            const planResetDate = userData?.planResetDate;
            if (!planResetDate) {
                // planResetDateがない場合は設定して終了
                await userRef.set({ planResetDate: new Date().toISOString() }, { merge: true });
                res.json({ success: true, reset: false, message: 'planResetDate initialized' });
                return;
            }
            // 月が変わったかチェック
            const resetDate = new Date(planResetDate);
            const now = new Date();
            const isMonthChanged = resetDate.getFullYear() !== now.getFullYear() ||
                resetDate.getMonth() !== now.getMonth();
            if (!isMonthChanged) {
                res.json({ success: true, reset: false, message: 'No reset needed' });
                return;
            }
            // 月次リセット実行（Admin SDKで直接更新、Firestoreルールを無視）
            await userRef.set({
                ocrUsedThisMonth: 0,
                chatUsedThisMonth: 0,
                planResetDate: now.toISOString(),
                // ocrQuotaBalance, chatQuotaBalance は繰り越し（更新しない）
            }, { merge: true });
            console.log(`[MonthlyReset] userId=${userId} reset from ${planResetDate} to ${now.toISOString()}`);
            res.json({
                success: true,
                reset: true,
                message: 'Monthly usage reset successfully',
                newResetDate: now.toISOString(),
            });
        }
        catch (error) {
            console.error('resetMonthlyUsageIfNeeded error:', error);
            res.status(500).json({ success: false, message: error.message || 'Reset failed' });
        }
    });
});
//# sourceMappingURL=index.js.map
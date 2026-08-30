require('dotenv').config();
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

// ---------------------------------------------------------------
// Firebase Admin SDK setup
// The service account JSON is stored as a single environment
// variable (FIREBASE_SERVICE_ACCOUNT) containing the full JSON
// text, so no key file needs to be committed to the repo.
// ---------------------------------------------------------------
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const SUBSCRIPTION_PRICE_CENTAVOS = parseInt(process.env.SUBSCRIPTION_PRICE_CENTAVOS || '9900', 10); // default P99.00
const SUCCESS_REDIRECT_URL = process.env.SUCCESS_REDIRECT_URL || 'https://noelrubio143.github.io/AMBERSSHVPN/payment-success.html';
const FAILED_REDIRECT_URL = process.env.FAILED_REDIRECT_URL || 'https://noelrubio143.github.io/AMBERSSHVPN/payment-failed.html';

// Webhook route needs the RAW body (for signature verification),
// so it must be registered BEFORE the global json() body parser.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const eventType = payload?.data?.attributes?.type;

    console.log('Webhook received:', eventType);

    if (eventType === 'source.chargeable') {
      await handleSourceChargeable(payload);
    } else if (eventType === 'payment.paid') {
      await handlePaymentPaid(payload);
    }

    // Always acknowledge quickly so PayMongo doesn't retry unnecessarily.
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).send('OK'); // still 200 so PayMongo doesn't hammer retries; log for manual review
  }
});

// Normal JSON body parser for all other routes.
app.use(express.json());
app.use(cors());

// ---------------------------------------------------------------
// POST /create-payment
// Called from the app when the user taps "Subscribe".
// Body: { userId: "<firebase uid>" }
// Returns: { checkoutUrl, sourceId }
// ---------------------------------------------------------------
app.post('/create-payment', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const response = await axios.post(
      'https://api.paymongo.com/v1/sources',
      {
        data: {
          attributes: {
            amount: SUBSCRIPTION_PRICE_CENTAVOS,
            redirect: {
              success: SUCCESS_REDIRECT_URL,
              failed: FAILED_REDIRECT_URL,
            },
            type: 'qrph',
            currency: 'PHP',
            metadata: { userId },
          },
        },
      },
      {
        auth: { username: PAYMONGO_SECRET_KEY, password: '' },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const sourceId = response.data.data.id;
    const checkoutUrl = response.data.data.attributes.redirect.checkout_url;

    // Record as pending so the webhook can look up which user paid.
    await db.collection('pendingPayments').doc(sourceId).set({
      userId,
      status: 'pending',
      amount: SUBSCRIPTION_PRICE_CENTAVOS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ checkoutUrl, sourceId });
  } catch (err) {
    console.error('create-payment error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// ---------------------------------------------------------------
// GET /health - simple check so Render's health check (and you)
// can confirm the service is alive.
// ---------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---------------------------------------------------------------
// Webhook handlers
// ---------------------------------------------------------------

/**
 * A QRPh/GCash-style "source" became chargeable once the user
 * completed payment in the checkout page. We now charge it.
 */
async function handleSourceChargeable(payload) {
  const sourceId = payload.data.attributes.data.id;

  const paymentResponse = await axios.post(
    'https://api.paymongo.com/v1/payments',
    {
      data: {
        attributes: {
          amount: SUBSCRIPTION_PRICE_CENTAVOS,
          currency: 'PHP',
          source: { id: sourceId, type: 'source' },
        },
      },
    },
    { auth: { username: PAYMONGO_SECRET_KEY, password: '' } }
  );

  const paymentStatus = paymentResponse.data.data.attributes.status;
  console.log(`Payment for source ${sourceId} status: ${paymentStatus}`);

  if (paymentStatus === 'paid') {
    await grantOneMonth(sourceId, paymentResponse.data.data.id);
  }
}

/**
 * Some PayMongo flows send payment.paid directly instead of (or in
 * addition to) source.chargeable. Handle it defensively too.
 */
async function handlePaymentPaid(payload) {
  const paymentObj = payload.data.attributes.data;
  const sourceId = paymentObj?.attributes?.source?.id;
  if (!sourceId) return;

  // Avoid double-granting if source.chargeable already handled it.
  const pendingDoc = await db.collection('pendingPayments').doc(sourceId).get();
  if (pendingDoc.exists && pendingDoc.data().status === 'completed') {
    console.log(`Source ${sourceId} already completed, skipping duplicate grant.`);
    return;
  }

  await grantOneMonth(sourceId, paymentObj.id);
}

/**
 * The actual "auto add 1 month" logic. Looks up which user this
 * source belonged to (via pendingPayments) and extends their
 * subscriptionExpiry by 30 days from now.
 */
async function grantOneMonth(sourceId, paymentId) {
  const pendingDoc = await db.collection('pendingPayments').doc(sourceId).get();
  if (!pendingDoc.exists) {
    console.error(`No pending payment found for source ${sourceId}`);
    return;
  }

  const { userId, status } = pendingDoc.data();
  if (status === 'completed') {
    console.log(`Source ${sourceId} already granted, skipping.`);
    return;
  }

  const now = new Date();
  const oneMonthLater = new Date(now);
  oneMonthLater.setDate(oneMonthLater.getDate() + 30);

  const userRef = db.collection('users').doc(userId);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    let newExpiry = oneMonthLater;

    // If the user already has time remaining, stack the new 30 days
    // on top instead of overwriting it.
    if (userSnap.exists) {
      const currentExpiry = userSnap.data().subscriptionExpiry?.toDate();
      if (currentExpiry && currentExpiry > now) {
        newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + 30);
      }
    }

    tx.set(
      userRef,
      {
        isPremium: true,
        subscriptionExpiry: admin.firestore.Timestamp.fromDate(newExpiry),
        lastPaymentId: paymentId,
        lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  await db.collection('pendingPayments').doc(sourceId).update({
    status: 'completed',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Granted 1 month to user ${userId}, new expiry: ${oneMonthLater.toISOString()}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Amber payment backend running on port ${PORT}`);
});

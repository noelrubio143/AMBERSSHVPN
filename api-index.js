// Place this file at: /api/index.js in your Vercel project

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

// ---------------------------------------------------------------
// Firebase Admin SDK setup
// ---------------------------------------------------------------
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const db = admin.firestore();

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const SUBSCRIPTION_PRICE_CENTAVOS = parseInt(process.env.SUBSCRIPTION_PRICE_CENTAVOS || '9900', 10);
const SUCCESS_REDIRECT_URL = process.env.SUCCESS_REDIRECT_URL || 'https://noelrubio143.github.io/AMBERSSHVPN/payment-success.html';
const FAILED_REDIRECT_URL = process.env.FAILED_REDIRECT_URL || 'https://noelrubio143.github.io/AMBERSSHVPN/payment-failed.html';

// ---------------------------------------------------------------
// CORS Configuration for Vercel
// ---------------------------------------------------------------
const corsOptions = {
  origin: [
    'https://noelrubio143.github.io',
    'https://your-app-domain.com',
    'http://localhost:3000',
    'http://localhost:19000',
    'http://localhost:8081'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Webhook route needs RAW body
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const eventType = payload?.data?.attributes?.type;

    console.log('Webhook received:', eventType);

    if (eventType === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(payload);
    } else if (eventType === 'payment_intent.payment_initiated') {
      console.log('Payment initiated for intent:', payload.data.id);
    } else if (eventType === 'source.chargeable') {
      await handleSourceChargeable(payload);
    } else if (eventType === 'payment.paid') {
      await handlePaymentPaid(payload);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).send('OK');
  }
});

// JSON body parser for all other routes
app.use(express.json());

// ---------------------------------------------------------------
// POST /api/create-payment
// ---------------------------------------------------------------
app.post('/api/create-payment', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (SUBSCRIPTION_PRICE_CENTAVOS < 100) {
      return res.status(400).json({ error: 'Amount must be at least PHP 1.00' });
    }

    // Step 1: Create Payment Intent
    const intentResponse = await axios.post(
      'https://api.paymongo.com/v1/payment_intents',
      {
        data: {
          attributes: {
            amount: SUBSCRIPTION_PRICE_CENTAVOS,
            payment_method_allowed: ['qrph'],
            currency: 'PHP',
            description: `AMBERSSHVPN subscription for user ${userId}`,
            statement_descriptor: 'AMBERSSHVPN',
            metadata: { userId },
          },
        },
      },
      {
        auth: { username: PAYMONGO_SECRET_KEY, password: '' },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const paymentIntentId = intentResponse.data.data.id;
    const clientKey = intentResponse.data.data.attributes.client_key;

    // Step 2: Create QR Ph Payment Method
    const methodResponse = await axios.post(
      'https://api.paymongo.com/v1/payment_methods',
      {
        data: {
          attributes: {
            type: 'qrph',
            billing: {
              name: `AMBERSSHVPN User ${userId}`,
              email: `${userId}@amberssh.app`,
              address: {
                line1: 'N/A',
                city: 'Manila',
                state: 'Metro Manila',
                postal_code: '1000',
                country: 'PH',
              },
            },
          },
        },
      },
      {
        auth: { username: PAYMONGO_SECRET_KEY, password: '' },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const paymentMethodId = methodResponse.data.data.id;

    // Step 3: Attach Payment Method to Intent
    const attachResponse = await axios.post(
      `https://api.paymongo.com/v1/payment_intents/${paymentIntentId}/attach`,
      {
        data: {
          attributes: {
            payment_method: paymentMethodId,
            client_key: clientKey,
          },
        },
      },
      {
        auth: { username: PAYMONGO_SECRET_KEY, password: '' },
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const paymentIntentStatus = attachResponse.data.data.attributes.status;
    const nextAction = attachResponse.data.data.attributes.next_action;
    const qrCodeImage = nextAction?.code?.image_url || null;

    // Save pending payment
    await db.collection('pendingPayments').doc(paymentIntentId).set({
      userId,
      status: 'pending',
      paymentIntentId,
      amount: SUBSCRIPTION_PRICE_CENTAVOS,
      paymentMethod: 'qrph',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Payment intent created: ${paymentIntentId}`);

    res.json({
      paymentIntentId,
      status: paymentIntentStatus,
      qrCodeImage,
    });
  } catch (err) {
    console.error('create-payment error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// ---------------------------------------------------------------
// GET /api/check-payment/:id
// ---------------------------------------------------------------
app.get('/api/check-payment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pendingDoc = await db.collection('pendingPayments').doc(id).get();
    let granted = false;
    let userId = null;
    let subscriptionExpiry = null;

    if (pendingDoc.exists) {
      const data = pendingDoc.data();
      userId = data.userId;
      granted = data.status === 'completed';

      if (granted && userId) {
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists) {
          const expiry = userSnap.data().subscriptionExpiry;
          subscriptionExpiry = expiry ? expiry.toDate().toISOString() : null;
        }
      }
    }

    let paymongoStatus = 'unknown';
    try {
      const response = await axios.get(
        `https://api.paymongo.com/v1/payment_intents/${id}`,
        { auth: { username: PAYMONGO_SECRET_KEY, password: '' } }
      );
      paymongoStatus = response.data.data.attributes.status;
    } catch (paymongoErr) {
      console.error('PayMongo lookup error:', paymongoErr.response?.data || paymongoErr.message);
    }

    res.json({
      paymentIntentId: id,
      paymongoStatus,
      granted,
      subscriptionExpiry,
    });
  } catch (err) {
    console.error('check-payment error:', err.message);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// ---------------------------------------------------------------
// GET /api/user-status/:userId
// ---------------------------------------------------------------
app.get('/api/user-status/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const userSnap = await db.collection('users').doc(userId).get();

    if (!userSnap.exists) {
      return res.json({ isPremium: false, subscriptionExpiry: null, active: false });
    }

    const data = userSnap.data();
    const isPremium = !!data.isPremium;
    const expiryDate = data.subscriptionExpiry ? data.subscriptionExpiry.toDate() : null;
    const active = isPremium && expiryDate !== null && expiryDate > new Date();

    res.json({
      isPremium,
      subscriptionExpiry: expiryDate ? expiryDate.toISOString() : null,
      active,
    });
  } catch (err) {
    console.error('user-status error:', err.message);
    res.status(500).json({ error: 'Failed to check user status' });
  }
});

// ---------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ---------------------------------------------------------------
// Webhook Handlers
// ---------------------------------------------------------------

async function handlePaymentIntentSucceeded(payload) {
  const paymentIntentId = payload.data.id;
  console.log(`Payment intent succeeded: ${paymentIntentId}`);

  const pendingDoc = await db.collection('pendingPayments').doc(paymentIntentId).get();
  if (!pendingDoc.exists) {
    console.error(`No pending payment found for intent ${paymentIntentId}`);
    return;
  }

  const { userId, status } = pendingDoc.data();

  if (status === 'completed') {
    console.log(`Intent ${paymentIntentId} already granted, skipping.`);
    return;
  }

  await grantOneMonth(paymentIntentId, userId);
}

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

async function handlePaymentPaid(payload) {
  const paymentObj = payload.data.attributes.data;
  const paymentIntentId = paymentObj?.attributes?.payment_intent_id;
  if (!paymentIntentId) {
    console.error('payment.paid webhook missing payment_intent_id');
    return;
  }

  await grantOneMonth(paymentIntentId, null);
}

async function grantOneMonth(paymentId, userId) {
  const pendingDoc = await db.collection('pendingPayments').doc(paymentId).get();
  if (!pendingDoc.exists) {
    console.error(`No pending payment found for payment ${paymentId}`);
    return;
  }

  const { userId: docUserId, status } = pendingDoc.data();
  const finalUserId = userId || docUserId;

  if (status === 'completed') {
    console.log(`Payment ${paymentId} already granted, skipping.`);
    return;
  }

  const now = new Date();
  const oneMonthLater = new Date(now);
  oneMonthLater.setDate(oneMonthLater.getDate() + 30);

  const userRef = db.collection('users').doc(finalUserId);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    let newExpiry = oneMonthLater;

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

  await db.collection('pendingPayments').doc(paymentId).update({
    status: 'completed',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Granted 1 month to user ${finalUserId}`);
}

// ---------------------------------------------------------------
// Export for Vercel
// ---------------------------------------------------------------
module.exports = app;

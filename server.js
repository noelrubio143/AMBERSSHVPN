require('dotenv').config();
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

// ===== FIREBASE SETUP =====
// Read individual env vars instead of JSON string
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ===== PAYMONGO CONFIG =====
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const SUBSCRIPTION_PRICE_CENTAVOS = parseInt(process.env.SUBSCRIPTION_PRICE_CENTAVOS || '9900', 10);

// ===== WEBHOOK (needs raw body) =====
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const eventType = payload?.data?.attributes?.type;

    console.log('Webhook received:', eventType);

    if (eventType === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(payload);
    } else if (eventType === 'payment.paid') {
      await handlePaymentPaid(payload);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(200).send('OK');
  }
});

// ===== BODY PARSER & CORS =====
app.use(express.json());
app.use(cors());

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ===== CREATE PAYMENT =====
app.post('/create-payment', async (req, res) => {
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
            description: `AMBERSSHVPN subscription for ${userId}`,
            statement_descriptor: 'AMBERSSHVPN',
            metadata: { userId },
          },
        },
      },
      { auth: { username: PAYMONGO_SECRET_KEY, password: '' } }
    );

    const paymentIntentId = intentResponse.data.data.id;
    const clientKey = intentResponse.data.data.attributes.client_key;

    // Step 2: Create Payment Method (QR Ph)
    const methodResponse = await axios.post(
      'https://api.paymongo.com/v1/payment_methods',
      {
        data: {
          attributes: {
            type: 'qrph',
            billing: {
              name: `User ${userId}`,
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
      { auth: { username: PAYMONGO_SECRET_KEY, password: '' } }
    );

    const paymentMethodId = methodResponse.data.data.id;

    // Step 3: Attach Method to Intent (QR code appears here)
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
      { auth: { username: PAYMONGO_SECRET_KEY, password: '' } }
    );

    const paymentIntentStatus = attachResponse.data.data.attributes.status;
    const qrCodeImage = attachResponse.data.data.attributes.next_action?.code?.image_url || null;

    // Record pending payment
    await db.collection('pendingPayments').doc(paymentIntentId).set({
      userId,
      status: 'pending',
      paymentIntentId,
      amount: SUBSCRIPTION_PRICE_CENTAVOS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Payment intent created: ${paymentIntentId}`);

    res.json({
      paymentIntentId,
      status: paymentIntentStatus,
      qrCodeImage,
    });
  } catch (err) {
    console.error('❌ create-payment error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// ===== CHECK PAYMENT STATUS =====
app.get('/check-payment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check Firestore
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
          subscriptionExpiry = userSnap.data().subscriptionExpiry?.toDate().toISOString() || null;
        }
      }
    }

    // Check PayMongo
    let paymongoStatus = 'unknown';
    try {
      const response = await axios.get(
        `https://api.paymongo.com/v1/payment_intents/${id}`,
        { auth: { username: PAYMONGO_SECRET_KEY, password: '' } }
      );
      paymongoStatus = response.data.data.attributes.status;
    } catch (err) {
      console.error('PayMongo lookup error:', err.message);
    }

    res.json({
      paymentIntentId: id,
      paymongoStatus,
      granted,
      subscriptionExpiry,
    });
  } catch (err) {
    console.error('❌ check-payment error:', err.message);
    res.status(500).json({ error: 'Failed to check payment' });
  }
});

// ===== CHECK USER STATUS =====
app.get('/user-status/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const userSnap = await db.collection('users').doc(userId).get();

    if (!userSnap.exists) {
      return res.json({ isPremium: false, subscriptionExpiry: null, active: false });
    }

    const data = userSnap.data();
    const isPremium = !!data.isPremium;
    const expiryDate = data.subscriptionExpiry?.toDate() || null;
    const active = isPremium && expiryDate && expiryDate > new Date();

    res.json({
      isPremium,
      subscriptionExpiry: expiryDate?.toISOString() || null,
      active,
    });
  } catch (err) {
    console.error('❌ user-status error:', err.message);
    res.status(500).json({ error: 'Failed to check user status' });
  }
});

// ===== WEBHOOK HANDLERS =====

async function handlePaymentIntentSucceeded(payload) {
  const paymentIntentId = payload.data.id;
  console.log(`✅ Payment succeeded: ${paymentIntentId}`);

  const pendingDoc = await db.collection('pendingPayments').doc(paymentIntentId).get();
  if (!pendingDoc.exists) {
    console.error(`❌ No pending payment for: ${paymentIntentId}`);
    return;
  }

  const { userId, status } = pendingDoc.data();

  if (status === 'completed') {
    console.log(`⚠️ Already granted: ${paymentIntentId}`);
    return;
  }

  await grantOneMonth(paymentIntentId, userId);
}

async function handlePaymentPaid(payload) {
  const paymentIntentId = payload.data.attributes.data?.attributes?.payment_intent_id;
  if (!paymentIntentId) {
    console.error('❌ Missing payment_intent_id in webhook');
    return;
  }

  await grantOneMonth(paymentIntentId, null);
}

async function grantOneMonth(paymentId, userId) {
  try {
    const pendingDoc = await db.collection('pendingPayments').doc(paymentId).get();
    if (!pendingDoc.exists) {
      console.error(`❌ No pending payment: ${paymentId}`);
      return;
    }

    const { userId: storedUserId, status } = pendingDoc.data();
    const finalUserId = userId || storedUserId;

    if (status === 'completed') {
      console.log(`⚠️ Already granted: ${paymentId}`);
      return;
    }

    // Calculate expiry
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setDate(oneMonthLater.getDate() + 30);

    const userRef = db.collection('users').doc(finalUserId);

    // Transaction: update user + mark payment complete
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      let newExpiry = oneMonthLater;

      // Stack 30 days on top if user already has time
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
          lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.update(
        db.collection('pendingPayments').doc(paymentId),
        {
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }
      );
    });

    console.log(`✅ Granted 1 month to ${finalUserId}, expires: ${oneMonthLater.toISOString()}`);
  } catch (err) {
    console.error(`❌ grantOneMonth error:`, err.message);
  }
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AMBERSSHVPN backend running on port ${PORT}`);
});

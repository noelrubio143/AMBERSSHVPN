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

    // New Payment Intents flow
    if (eventType === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(payload);
    } else if (eventType === 'payment_intent.payment_initiated') {
      // Optional: Log when payment is initiated but not yet completed
      console.log('Payment initiated for intent:', payload.data.id);
    }
    // Keep old handlers for backward compatibility if needed
    else if (eventType === 'source.chargeable') {
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
// Returns: { paymentIntentId, qrCodeImage }
// ---------------------------------------------------------------
app.post('/create-payment', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Minimum amount check for QRPh (PHP 1.00 = 100 centavos)
    if (SUBSCRIPTION_PRICE_CENTAVOS < 100) {
      return res.status(400).json({ error: 'Amount must be at least PHP 1.00' });
    }

    // Step 1: Create the Payment Intent, allowing QR Ph (this is what
    // actually generates a scannable QR image — 'gcash' by itself is
    // a redirect-to-checkout-page method, not an in-app QR).
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
            metadata: {
              userId: userId,
            },
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

    // Step 2: Create a QR Ph Payment Method. Billing name/email/address
    // are required by PayMongo even though we don't otherwise collect
    // them from users of the app — placeholders are fine here since
    // they don't affect where the money settles.
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

    // Step 3: Attach the Payment Method to the Payment Intent. The QR
    // image only appears in THIS response, under next_action.code.image_url.
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
    const qrCodeImage = nextAction?.code?.image_url || null; // Base64 data URI

    // Record as pending so the webhook can look up which user paid.
    await db.collection('pendingPayments').doc(paymentIntentId).set({
      userId,
      status: 'pending',
      paymentIntentId,
      amount: SUBSCRIPTION_PRICE_CENTAVOS,
      paymentMethod: 'qrph',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Payment intent created: ${paymentIntentId}, status: ${paymentIntentStatus}`);

    // Return both the intent ID and QR code image
    res.json({ 
      paymentIntentId, 
      status: paymentIntentStatus,
      qrCodeImage, // data:image/png;base64,... — render directly as an <img src> or decode on the app side
    });
  } catch (err) {
    console.error('create-payment error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// ---------------------------------------------------------------
// GET /check-payment/:id
// Polled by the app while the QR code is on screen, using the
// paymentIntentId returned from /create-payment.
//
// It checks TWO things:
//   1. Our own Firestore record (pendingPayments/<id>) — this is
//      the source of truth for whether the subscription was
//      actually granted, since that only happens once the
//      /webhook route fires and grantOneMonth() runs.
//   2. The live PayMongo payment_intent status — useful to show
//      the user "waiting for payment" vs "processing" vs failed,
//      even before the webhook has landed.
//
// Returns: { paymentIntentId, paymongoStatus, granted, subscriptionExpiry }
// ---------------------------------------------------------------
app.get('/check-payment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Firestore: has the webhook already granted this?
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

    // 2. PayMongo: live status of the payment intent itself.
    let paymongoStatus = 'unknown';
    try {
      const response = await axios.get(
        `https://api.paymongo.com/v1/payment_intents/${id}`,
        { auth: { username: PAYMONGO_SECRET_KEY, password: '' } }
      );
      paymongoStatus = response.data.data.attributes.status;
    } catch (paymongoErr) {
      console.error('check-payment paymongo lookup error:', paymongoErr.response?.data || paymongoErr.message);
    }

    res.json({
      paymentIntentId: id,
      paymongoStatus,   // e.g. "awaiting_payment_method", "processing", "succeeded"
      granted,          // true only once our webhook has actually extended the subscription
      subscriptionExpiry,
    });
  } catch (err) {
    console.error('check-payment error:', err.message);
    res.status(500).json({ error: 'Failed to check payment status' });
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
 * NEW HANDLER: Payment Intent Succeeded
 * Called when the customer successfully completed the QRPh payment.
 */
async function handlePaymentIntentSucceeded(payload) {
  const paymentIntentId = payload.data.id;
  const paymentIntentData = payload.data.attributes;

  console.log(`Payment intent succeeded: ${paymentIntentId}`);

  // Look up the pending payment to get the userId
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

  // Grant the subscription
  await grantOneMonth(paymentIntentId, userId);
}

/**
 * OLD HANDLER: Source Chargeable (for backward compatibility)
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
 * OLD HANDLER: Payment Paid (for backward compatibility)
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
 * payment belonged to (via pendingPayments) and extends their
 * subscriptionExpiry by 30 days from now.
 */
async function grantOneMonth(paymentId, userId) {
  const pendingDoc = await db.collection('pendingPayments').doc(paymentId).get();
  if (!pendingDoc.exists) {
    console.error(`No pending payment found for payment ${paymentId}`);
    return;
  }

  const { userId: docUserId, status } = pendingDoc.data();
  const finalUserId = userId || docUserId; // Use provided userId or fallback to stored

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

  await db.collection('pendingPayments').doc(paymentId).update({
    status: 'completed',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Granted 1 month to user ${finalUserId}, new expiry: ${oneMonthLater.toISOString()}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Amber payment backend running on port ${PORT}`);
});

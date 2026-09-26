// app/api/gcash-webhook/route.js
// Webhook endpoint for GCash payment confirmations

import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

const GCASH_WEBHOOK_SECRET = process.env.GCASH_WEBHOOK_SECRET || '';

// Verify webhook signature
function verifyGCashSignature(payload, signature) {
  const hash = crypto
    .createHmac('sha256', GCASH_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}

export async function POST(req) {
  try {
    const payload = await req.json();
    const signature = req.headers.get('x-gcash-signature');

    // Verify webhook authenticity
    if (!verifyGCashSignature(payload, signature)) {
      return Response.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const { reference, status, amount, timestamp } = payload;

    if (!reference || !status) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find the order in Firestore
    const orderDoc = await adminDb.collection('orders').doc(reference).get();
    if (!orderDoc.exists) {
      return Response.json(
        { error: 'Order not found', reference },
        { status: 404 }
      );
    }

    const order = orderDoc.data();
    const userId = order.userId;

    if (status === 'completed' || status === 'paid') {
      // Payment successful - grant subscription
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + order.daysGrant);

      // Update order status
      await adminDb.collection('orders').doc(reference).update({
        status: 'completed',
        granted: true,
        paidAt: new Date().toISOString(),
        grantedExpiry: expiryDate.toISOString(),
      });

      // Update user subscription
      await adminDb.collection('users').doc(userId).set(
        {
          subscriptionExpiry: expiryDate.toISOString(),
          active: true,
          lastPaymentMethod: 'gcash',
          lastPaymentDate: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`GCash payment successful for user ${userId}: reference ${reference}`);
    } else if (status === 'failed' || status === 'expired') {
      // Payment failed
      await adminDb.collection('orders').doc(reference).update({
        status: 'failed',
        failedAt: new Date().toISOString(),
      });

      console.log(`GCash payment failed for user ${userId}: reference ${reference}`);
    }

    return Response.json({ success: true, reference });
  } catch (err) {
    console.error('gcash-webhook error:', err);
    return Response.json(
      { error: err.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

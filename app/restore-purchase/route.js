import { adminDb } from '@/lib/firebase-admin';

/**
 * Lets a user restore their subscription on a new device (e.g. after
 * clearing app data or reinstalling), using the "Receipt Code"
 * (paymentIntentId) shown to them after a successful GCash/QRPh payment.
 *
 * Body: { "paymentIntentId": "pi_xxxxx", "userId": "<current device id>" }
 * Response: { success: true, subscriptionExpiry, active } on success
 */
export async function POST(req) {
  try {
    const { paymentIntentId, userId } = await req.json();

    if (!paymentIntentId || !userId) {
      return Response.json({ error: 'Missing paymentIntentId or userId' }, { status: 400 });
    }

    const paymentDoc = await adminDb.collection('payments').doc(paymentIntentId).get();
    if (!paymentDoc.exists) {
      return Response.json({ error: 'Receipt code not found' }, { status: 404 });
    }

    const payment = paymentDoc.data();
    if (!payment.granted) {
      return Response.json({ error: 'This payment was never completed' }, { status: 400 });
    }

    const originalUserId = payment.userId;
    const userDoc = await adminDb.collection('users').doc(originalUserId).get();
    if (!userDoc.exists || !userDoc.data().subscriptionExpiry) {
      return Response.json({ error: 'No subscription found for this receipt code' }, { status: 404 });
    }

    const { subscriptionExpiry, isPremium } = userDoc.data();

    // Link the subscription to whichever device is asking to restore it.
    await adminDb.collection('users').doc(userId).set(
      { subscriptionExpiry, isPremium },
      { merge: true }
    );

    const active = new Date(subscriptionExpiry) > new Date();

    return Response.json({ success: true, subscriptionExpiry, active });
  } catch (err) {
    console.error('restore-purchase error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

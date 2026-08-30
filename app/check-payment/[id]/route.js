import { adminDb } from '@/lib/firebase-admin';

export async function GET(req, { params }) {
  try {
    const paymentIntentId = params.id;
    const paymentDoc = await adminDb.collection('payments').doc(paymentIntentId).get();

    if (!paymentDoc.exists) {
      return Response.json({ error: 'Payment not found' }, { status: 404 });
    }

    const payment = paymentDoc.data();
    let subscriptionExpiry = null;

    if (payment.granted && payment.userId) {
      const userDoc = await adminDb.collection('users').doc(payment.userId).get();
      if (userDoc.exists) {
        subscriptionExpiry = userDoc.data().subscriptionExpiry || null;
      }
    }

    return Response.json({
      paymentIntentId,
      paymongoStatus: payment.status || 'processing',
      granted: !!payment.granted,
      subscriptionExpiry,
    });
  } catch (err) {
    console.error('check-payment error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

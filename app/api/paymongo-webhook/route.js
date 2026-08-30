// app/api/paymongo-webhook/route.js
// Receives PayMongo webhook events and updates the order status in Firestore.
// Register this URL in the PayMongo Dashboard: https://your-domain.vercel.app/api/paymongo-webhook

import { adminDb } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const event = await req.json();
    const eventType = event?.data?.attributes?.type;

    console.log('PayMongo webhook received:', eventType);

    if (eventType === 'payment.paid') {
      const paymentData = event.data.attributes.data;
      const paymentIntentId = paymentData?.attributes?.payment_intent_id;

      if (paymentIntentId) {
        await adminDb.collection('orders').doc(paymentIntentId).update({
          status: 'paid',
          paidAt: new Date().toISOString(),
        });
      }
    }

    if (eventType === 'payment.failed') {
      const paymentData = event.data.attributes.data;
      const paymentIntentId = paymentData?.attributes?.payment_intent_id;

      if (paymentIntentId) {
        await adminDb.collection('orders').doc(paymentIntentId).update({
          status: 'failed',
        });
      }
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error('paymongo-webhook error:', err);
    return Response.json({ received: true, error: err.message });
  }
}

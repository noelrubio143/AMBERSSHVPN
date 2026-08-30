import { adminDb } from '@/lib/firebase-admin';
import { SUBSCRIPTION_DAYS } from '@/lib/paymongo';

export async function POST(req) {
  try {
    const event = await req.json();
    const eventType = event?.data?.attributes?.type;

    if (eventType === 'payment.paid') {
      const paymentData = event.data.attributes.data;
      const paymentIntentId = paymentData?.attributes?.payment_intent_id;

      if (paymentIntentId) {
        const paymentRef = adminDb.collection('payments').doc(paymentIntentId);
        const paymentDoc = await paymentRef.get();

        if (paymentDoc.exists) {
          const { userId } = paymentDoc.data();
          const userRef = adminDb.collection('users').doc(userId);
          const userDoc = await userRef.get();

          const now = new Date();
          const currentExpiry =
            userDoc.exists && userDoc.data().subscriptionExpiry
              ? new Date(userDoc.data().subscriptionExpiry)
              : now;
          const base = currentExpiry > now ? currentExpiry : now;
          const newExpiry = new Date(base.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

          await userRef.set(
            { subscriptionExpiry: newExpiry.toISOString(), isPremium: true },
            { merge: true }
          );

          await paymentRef.update({
            status: 'paid',
            granted: true,
            paidAt: now.toISOString(),
          });
        }
      }
    }

    if (eventType === 'payment.failed') {
      const paymentData = event.data.attributes.data;
      const paymentIntentId = paymentData?.attributes?.payment_intent_id;
      if (paymentIntentId) {
        await adminDb.collection('payments').doc(paymentIntentId).update({ status: 'failed' });
      }
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error('paymongo-webhook error:', err);
    return Response.json({ received: true, error: err.message });
  }
}

import crypto from 'crypto';
import { admin, adminDb } from '@/lib/firebase-admin';
import { SUBSCRIPTION_DAYS } from '@/lib/paymongo';

// ADDED: signature check. Active only when PAYMONGO_WEBHOOK_SECRET (whsk_...) is set in env,
// so nothing breaks until you add it. Strongly recommended to set it.
function validSignature(raw, header) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex');
  const given = parts.li || parts.te;
  if (!given || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(req) {
  try {
    const raw = await req.text();
    if (!validSignature(raw, req.headers.get('paymongo-signature'))) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
    const event = JSON.parse(raw);
    const eventType = event?.data?.attributes?.type;

    if (eventType === 'payment.paid') {
      const paymentData = event.data.attributes.data;
      const paymentIntentId = paymentData?.attributes?.payment_intent_id;

      if (paymentIntentId) {
        const paymentRef = adminDb.collection('payments').doc(paymentIntentId);
        const paymentDoc = await paymentRef.get();

        if (paymentDoc.exists) {
          // ADDED: any-amount top-up -> credit users/{userId}.balance (once only)
          if (paymentDoc.data().type === 'topup') {
            await adminDb.runTransaction(async (tx) => {
              const doc = await tx.get(paymentRef);
              const p = doc.data();
              if (p.granted) return; // webhook retry, already credited
              const paidCentavos = paymentData?.attributes?.amount;
              if (typeof paidCentavos === 'number' && paidCentavos !== Math.round(p.amount * 100)) {
                tx.update(paymentRef, { status: 'amount_mismatch' });
                return;
              }
              tx.set(
                adminDb.collection('users').doc(p.userId),
                { balance: admin.firestore.FieldValue.increment(p.amount) },
                { merge: true }
              );
              tx.update(paymentRef, { status: 'paid', granted: true, paidAt: new Date().toISOString() });
            });
            return Response.json({ received: true });
          }

          // ---- ORIGINAL subscription logic (unchanged) ----
          const { userId, months } = paymentDoc.data();
          const planMonths = Number.isInteger(months) && months > 0 ? months : 1;
          const userRef = adminDb.collection('users').doc(userId);
          const userDoc = await userRef.get();

          const now = new Date();
          const currentExpiry =
            userDoc.exists && userDoc.data().subscriptionExpiry
              ? new Date(userDoc.data().subscriptionExpiry)
              : now;
          const base = currentExpiry > now ? currentExpiry : now;
          const newExpiry = new Date(base.getTime() + planMonths * SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

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

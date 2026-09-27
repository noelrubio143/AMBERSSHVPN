import { createSubscriptionPayment, SUBSCRIPTION_PRICE_PESOS } from '@/lib/paymongo';
import { adminDb } from '@/lib/firebase-admin';

// Official pricing table (pesos) — kept on the server so the client can't
// just send an arbitrary amount. Must match PaymentMethodPicker in the app.
const PRICING_TABLE = {
  1: 50, 2: 100, 3: 150, 4: 200, 5: 250, 6: 300,
  7: 350, 8: 400, 9: 450, 10: 500, 11: 550, 12: 600,
};

export async function POST(req) {
  try {
    const { userId, months } = await req.json();
    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 400 });
    }

    const planMonths = Number.isInteger(months) && PRICING_TABLE[months] ? months : 1;
    const amount = PRICING_TABLE[planMonths] ?? SUBSCRIPTION_PRICE_PESOS;

    const payment = await createSubscriptionPayment(userId, amount);

    await adminDb.collection('payments').doc(payment.paymentIntentId).set({
      userId,
      amount,
      months: planMonths,
      status: 'pending',
      granted: false,
      createdAt: new Date().toISOString(),
    });

    return Response.json({
      paymentIntentId: payment.paymentIntentId,
      status: payment.status,
      qrCodeImage: payment.qrCodeImage,
    });
  } catch (err) {
    console.error('create-payment error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

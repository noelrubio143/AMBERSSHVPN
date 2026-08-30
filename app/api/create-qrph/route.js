import { createSubscriptionPayment, SUBSCRIPTION_PRICE_PESOS } from '@/lib/paymongo';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return Response.json({ error: 'Missing userId' }, { status: 400 });
    }
    const payment = await createSubscriptionPayment(userId);

    await adminDb.collection('payments').doc(payment.paymentIntentId).set({
      userId,
      amount: SUBSCRIPTION_PRICE_PESOS,
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

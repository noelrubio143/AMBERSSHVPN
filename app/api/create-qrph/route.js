// app/api/create-qrph/route.js
// POST endpoint: creates a QR Ph payment via PayMongo and logs a pending
// payment record in Firestore under "payments" (this is the collection the
// paymongo-webhook, transactions, and restore-purchase routes all read from).

import { createQrphPayment } from '@/lib/paymongo';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const { userId, amount, name, email, phone, address } = await req.json();

    if (!userId || !amount || !name || !email || !address) {
      return Response.json(
        { error: 'Missing required fields: userId, amount, name, email, address' },
        { status: 400 }
      );
    }

    const payment = await createQrphPayment({ amount, name, email, phone, address });

    // Doc ID = paymentIntentId, so the webhook can look this up directly
    // once PayMongo reports it as paid, and grant the subscription to userId.
    await adminDb.collection('payments').doc(payment.paymentIntentId).set({
      userId,
      amount,
      name,
      email,
      phone: phone || null,
      status: 'pending',
      granted: false,
      createdAt: new Date().toISOString(),
    });

    return Response.json({
      paymentIntentId: payment.paymentIntentId,
      qrImageUrl: payment.qrImageUrl,
      status: payment.status,
    });
  } catch (err) {
    console.error('create-qrph error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

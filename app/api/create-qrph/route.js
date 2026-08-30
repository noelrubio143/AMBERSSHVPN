// app/api/create-qrph/route.js
// POST endpoint: creates a QR Ph payment via PayMongo and logs a pending order in Firestore

import { createQrphPayment } from '@/lib/paymongo';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const { amount, name, email, phone, address } = await req.json();

    if (!amount || !name || !email || !address) {
      return Response.json(
        { error: 'Missing required fields: amount, name, email, address' },
        { status: 400 }
      );
    }

    const payment = await createQrphPayment({ amount, name, email, phone, address });

    await adminDb.collection('orders').doc(payment.paymentIntentId).set({
      amount,
      name,
      email,
      phone: phone || null,
      status: 'pending',
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

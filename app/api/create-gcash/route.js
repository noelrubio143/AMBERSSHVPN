// app/api/create-gcash/route.js
// POST endpoint: creates a GCash QR payment and logs a pending order in Firestore

import { generateGCashQR, generateReferenceNumber } from '@/lib/payment-methods';
import { adminDb } from '@/lib/firebase-admin';

const SUBSCRIPTION_PRICE_PESOS = 50;
const SUBSCRIPTION_DAYS = 30;

export async function POST(req) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return Response.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    // Generate GCash QR code
    const gcashPayment = await generateGCashQR(
      SUBSCRIPTION_PRICE_PESOS,
      userId,
      'AMBER VPN'
    );

    // Log the order in Firestore
    await adminDb.collection('orders').doc(gcashPayment.reference).set({
      userId,
      amount: SUBSCRIPTION_PRICE_PESOS,
      currency: 'PHP',
      paymentMethod: 'gcash',
      reference: gcashPayment.reference,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
      daysGrant: SUBSCRIPTION_DAYS,
    });

    return Response.json({
      paymentIntentId: gcashPayment.reference,
      qrCodeImage: gcashPayment.qrCodeImage,
      gcashUrl: gcashPayment.gcashUrl,
      amount: SUBSCRIPTION_PRICE_PESOS,
      type: 'gcash',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.error('create-gcash error:', err);
    return Response.json(
      { error: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

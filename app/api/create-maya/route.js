// app/api/create-maya/route.js
// POST endpoint: creates a Maya payment session and logs a pending order in Firestore

import { generateMayaPaymentLink, generateReferenceNumber } from '@/lib/payment-methods';
import { adminDb } from '@/lib/firebase-admin';

const SUBSCRIPTION_PRICE_PESOS = 50;
const SUBSCRIPTION_DAYS = 30;

export async function POST(req) {
  try {
    const { userId, mayaUsername, mayaPassword } = await req.json();

    if (!userId) {
      return Response.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    // Generate Maya payment link
    const mayaPayment = await generateMayaPaymentLink(
      SUBSCRIPTION_PRICE_PESOS,
      userId,
      'AMBER VPN Subscription - 30 Days'
    );

    // Log the order in Firestore
    await adminDb.collection('orders').doc(mayaPayment.reference).set({
      userId,
      amount: SUBSCRIPTION_PRICE_PESOS,
      currency: 'PHP',
      paymentMethod: 'maya',
      reference: mayaPayment.reference,
      mayaSessionId: mayaPayment.mayaSessionId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hour expiry
      daysGrant: SUBSCRIPTION_DAYS,
      // Note: Do NOT store sensitive credentials in Firestore
      // Credentials should be handled securely on client-side only
    });

    return Response.json({
      paymentIntentId: mayaPayment.reference,
      mayaSessionId: mayaPayment.mayaSessionId,
      checkoutUrl: mayaPayment.checkoutUrl,
      amount: SUBSCRIPTION_PRICE_PESOS,
      type: 'maya',
      credentialsRequired: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      instructions: 'Open the checkout URL and authenticate with your Maya credentials',
    });
  } catch (err) {
    console.error('create-maya error:', err);
    return Response.json(
      { error: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

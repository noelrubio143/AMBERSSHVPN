// app/api/check-payment-status/[reference]/route.js
// GET endpoint: check the status of a GCash or Maya payment

import { adminDb } from '@/lib/firebase-admin';

export async function GET(req, { params }) {
  try {
    const { reference } = params;

    if (!reference) {
      return Response.json(
        { error: 'Missing reference parameter' },
        { status: 400 }
      );
    }

    // Find the order in Firestore
    const orderDoc = await adminDb.collection('orders').doc(reference).get();
    
    if (!orderDoc.exists) {
      return Response.json(
        { error: 'Payment not found', reference },
        { status: 404 }
      );
    }

    const order = orderDoc.data();
    const { status, granted, paymentMethod, grantedExpiry, createdAt } = order;

    // Check if payment has expired (pending too long)
    const createdTime = new Date(createdAt).getTime();
    const nowTime = Date.now();
    const expiryHours = paymentMethod === 'gcash' ? 0.5 : 24; // GCash: 30 mins, Maya: 24 hours
    const expiryMs = expiryHours * 60 * 60 * 1000;
    
    let finalStatus = status;
    if (status === 'pending' && (nowTime - createdTime) > expiryMs) {
      finalStatus = 'expired';
      // Update order to expired
      await adminDb.collection('orders').doc(reference).update({
        status: 'expired',
        updatedAt: new Date().toISOString(),
      });
    }

    return Response.json({
      reference,
      status: finalStatus,
      paymentMethod,
      granted: granted || false,
      subscriptionExpiry: grantedExpiry || null,
      createdAt,
    });
  } catch (err) {
    console.error('check-payment-status error:', err);
    return Response.json(
      { error: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

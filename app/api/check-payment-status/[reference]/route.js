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

    // QRPh/PayMongo payments live in "payments"; GCash/Maya live in "orders".
    // Check "payments" first, then fall back to "orders".
    let doc = await adminDb.collection('payments').doc(reference).get();
    let fromOrders = false;

    if (!doc.exists) {
      doc = await adminDb.collection('orders').doc(reference).get();
      fromOrders = true;
    }

    if (!doc.exists) {
      return Response.json(
        { error: 'Payment not found', reference },
        { status: 404 }
      );
    }

    const data = doc.data();

    if (fromOrders) {
      const { status, granted, paymentMethod, grantedExpiry, createdAt } = data;

      // Check if payment has expired (pending too long) — PayMongo QR Ph
      // intents are the only flow now, treated with a 24h grace window.
      const createdTime = new Date(createdAt).getTime();
      const nowTime = Date.now();
      const expiryMs = 24 * 60 * 60 * 1000;

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
    }

    // QRPh/PayMongo payment (from "payments" collection)
    const { status, granted, createdAt } = data;
    let subscriptionExpiry = null;
    if (granted && data.userId) {
      const userDoc = await adminDb.collection('users').doc(data.userId).get();
      if (userDoc.exists) {
        subscriptionExpiry = userDoc.data().subscriptionExpiry || null;
      }
    }

    return Response.json({
      reference,
      status: status || 'processing',
      paymentMethod: 'qrph',
      granted: !!granted,
      subscriptionExpiry,
      createdAt: createdAt || null,
    });
  } catch (err) {
    console.error('check-payment-status error:', err);
    return Response.json(
      { error: err.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

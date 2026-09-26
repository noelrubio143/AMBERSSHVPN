// app/api/maya-webhook/route.js
// Webhook endpoint for Maya payment confirmations

import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

const MAYA_WEBHOOK_SECRET = process.env.MAYA_WEBHOOK_SECRET || '';

// Verify webhook signature (Maya uses HMAC-SHA256)
function verifyMayaSignature(payload, signature) {
  const hash = crypto
    .createHmac('sha256', MAYA_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return hash === signature;
}

export async function POST(req) {
  try {
    const payload = await req.json();
    const signature = req.headers.get('x-maya-signature');

    // Verify webhook authenticity
    if (!verifyMayaSignature(payload, signature)) {
      console.warn('Invalid Maya webhook signature');
      return Response.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const { 
      requestReferenceNumber, 
      status, 
      amount, 
      metadata,
      paymentSessionId 
    } = payload;

    if (!requestReferenceNumber || !status) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find the order in Firestore
    const orderDoc = await adminDb.collection('orders').doc(requestReferenceNumber).get();
    if (!orderDoc.exists) {
      console.warn(`Order not found: ${requestReferenceNumber}`);
      return Response.json(
        { error: 'Order not found', reference: requestReferenceNumber },
        { status: 404 }
      );
    }

    const order = orderDoc.data();
    const userId = order.userId;

    if (status === 'SUCCESS' || status === 'AUTHORIZED' || status === 'PAYMENT_SUCCESS') {
      // Payment successful - grant subscription
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + order.daysGrant);

      // Update order status
      await adminDb.collection('orders').doc(requestReferenceNumber).update({
        status: 'completed',
        granted: true,
        paidAt: new Date().toISOString(),
        grantedExpiry: expiryDate.toISOString(),
        mayaPaymentSessionId: paymentSessionId,
      });

      // Update user subscription
      await adminDb.collection('users').doc(userId).set(
        {
          subscriptionExpiry: expiryDate.toISOString(),
          active: true,
          lastPaymentMethod: 'maya',
          lastPaymentDate: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(`Maya payment successful for user ${userId}: reference ${requestReferenceNumber}`);
    } else if (status === 'FAILED' || status === 'DECLINED' || status === 'EXPIRED') {
      // Payment failed
      await adminDb.collection('orders').doc(requestReferenceNumber).update({
        status: 'failed',
        failedAt: new Date().toISOString(),
        failureReason: status,
      });

      console.log(`Maya payment failed for user ${userId}: reference ${requestReferenceNumber}, reason: ${status}`);
    } else if (status === 'PENDING' || status === 'PROCESSING') {
      // Update to processing status
      await adminDb.collection('orders').doc(requestReferenceNumber).update({
        status: 'processing',
        updatedAt: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, reference: requestReferenceNumber });
  } catch (err) {
    console.error('maya-webhook error:', err);
    return Response.json(
      { error: err.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

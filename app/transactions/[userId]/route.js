import { adminDb } from '@/lib/firebase-admin';

// Returns every payment record for this device/user, most recent first, so
// the app can show a "Transactions" screen with each receipt code (the
// document ID / paymentIntentId), its status, amount, and date.
export async function GET(req, { params }) {
  try {
    const userId = params.userId;

    const snapshot = await adminDb
      .collection('payments')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const transactions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        paymentIntentId: doc.id,
        amount: data.amount ?? null,
        status: data.status || 'pending',
        granted: !!data.granted,
        createdAt: data.createdAt || null,
        paidAt: data.paidAt || null,
      };
    });

    return Response.json({ transactions });
  } catch (err) {
    console.error('transactions error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

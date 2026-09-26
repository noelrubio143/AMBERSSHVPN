import { adminDb } from '@/lib/firebase-admin';

// Returns every payment record for this device/user, most recent first, so
// the app can show a "Transactions" screen with each receipt code (the
// document ID / paymentIntentId), its status, amount, and date.
export async function GET(req, { params }) {
  try {
    const userId = params.userId;

    // QRPh/PayMongo payments live in "payments"; GCash/Maya live in "orders".
    // Read both and merge so every payment method shows up here.
    const [paymentsSnap, ordersSnap] = await Promise.all([
      adminDb.collection('payments').where('userId', '==', userId).get(),
      adminDb.collection('orders').where('userId', '==', userId).get(),
    ]);

    const toTransaction = (doc) => {
      const data = doc.data();
      return {
        paymentIntentId: doc.id,
        amount: data.amount ?? null,
        status: data.status || 'pending',
        granted: !!data.granted,
        createdAt: data.createdAt || null,
        paidAt: data.paidAt || null,
      };
    };

    const transactions = [
      ...paymentsSnap.docs.map(toTransaction),
      ...ordersSnap.docs.map(toTransaction),
    ].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    return Response.json({ transactions });
  } catch (err) {
    console.error('transactions error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

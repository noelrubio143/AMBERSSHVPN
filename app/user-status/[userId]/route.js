import { adminDb } from '@/lib/firebase-admin';

export async function GET(req, { params }) {
  try {
    const userId = params.userId;
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return Response.json({ isPremium: false, subscriptionExpiry: null, active: false });
    }

    const user = userDoc.data();
    const subscriptionExpiry = user.subscriptionExpiry || null;
    const active = subscriptionExpiry ? new Date(subscriptionExpiry) > new Date() : false;

    return Response.json({ isPremium: active, subscriptionExpiry, active });
  } catch (err) {
    console.error('user-status error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

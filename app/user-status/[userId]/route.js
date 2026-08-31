import { adminDb } from '@/lib/firebase-admin';

// Device IDs that always get full access, regardless of subscriptionExpiry -
// for the developer's own testing device(s). This does NOT touch the normal
// paid-subscription flow for anyone else; it's just an early-return before
// the Firestore lookup.
const ADMIN_USER_IDS = [
  '9f617fce-9a71-48b4-95f7-3369f1119aa5',
];

export async function GET(req, { params }) {
  try {
    const userId = params.userId;

    if (ADMIN_USER_IDS.includes(userId)) {
      return Response.json({ isPremium: true, subscriptionExpiry: null, active: true });
    }

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

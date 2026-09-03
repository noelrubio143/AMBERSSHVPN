import { adminDb } from '@/lib/firebase-admin';

// Legacy: device IDs that always get full access, regardless of Firestore
// state - kept for backward compatibility, but you don't need to add to
// this list anymore (requires a redeploy). Prefer setting `unlimited: true`
// on the user's Firestore doc instead - see below, no redeploy needed.
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

    // Editable "unlimited" grant: in Firebase Console -> Firestore ->
    // users/{userId}, add a boolean field `unlimited` and set it to true.
    // Takes effect immediately, no code change or redeploy needed. Set it
    // back to false (or delete the field) to revoke.
    if (user.unlimited === true) {
      return Response.json({ isPremium: true, subscriptionExpiry: null, active: true });
    }

    const subscriptionExpiry = user.subscriptionExpiry || null;
    const active = subscriptionExpiry ? new Date(subscriptionExpiry) > new Date() : false;

    return Response.json({ isPremium: active, subscriptionExpiry, active });
  } catch (err) {
    console.error('user-status error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

import { adminDb } from '@/lib/firebase-admin';
import { ADMIN_USER_IDS } from '@/lib/access';

// Legacy admin device IDs live in lib/access.js (shared with game-win).

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

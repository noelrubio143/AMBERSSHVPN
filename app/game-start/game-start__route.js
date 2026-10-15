import { adminDb } from '@/lib/firebase-admin';
import { ADMIN_USER_IDS, validUserId, manilaDay } from '@/lib/access';

/**
 * Called by the app when a game match begins.
 * Body: { userId }
 * Response: { matchId } | { matchId: null, claimedToday: true } | { matchId: null, lifetime: true }
 *
 * The server stamps the start time. /game-win only pays out if enough SERVER
 * time has passed since this call, so the phone cannot fake a match length.
 */
export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!validUserId(userId)) {
      return Response.json({ error: 'Invalid userId' }, { status: 400 });
    }

    if (ADMIN_USER_IDS.includes(userId)) {
      return Response.json({ matchId: null, lifetime: true });
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : {};
    if (user.unlimited === true) {
      return Response.json({ matchId: null, lifetime: true });
    }
    if (user.lastWinDay === manilaDay()) {
      return Response.json({ matchId: null, claimedToday: true });
    }

    const now = Date.now();
    const ref = adminDb.collection('gameMatches').doc();
    await ref.set({
      userId,
      startedAtMs: now,
      used: false,
      // Optional: enable a Firestore TTL policy on "expireAt" to auto-clean old matches.
      expireAt: new Date(now + 24 * 60 * 60 * 1000),
    });

    return Response.json({ matchId: ref.id });
  } catch (err) {
    console.error('game-start error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

import { adminDb } from '@/lib/firebase-admin';
import { ADMIN_USER_IDS, validUserId, manilaDay } from '@/lib/access';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MATCH_MS = 90 * 1000;        // same 90s minimum the game uses, but enforced by the server clock
const MAX_MATCH_MS = 3 * 60 * 60 * 1000; // match tokens older than this are rejected

/**
 * Claim the "win = +1 day" bonus.
 * Body: { userId, matchId }   (matchId comes from /game-start)
 *
 * The SERVER decides everything:
 *  - the match must exist, belong to this user, and not be used before
 *  - at least 90s of server time must have passed since /game-start
 *  - only ONE bonus per user per day (Asia/Manila calendar day)
 *  - the +1 day is added to users/{id}.subscriptionExpiry in Firestore
 *    (stacks with paid time; the webhook extends from the same field)
 *
 * Response: { result: 'granted' | 'already' | 'lifetime', subscriptionExpiry }
 */
export async function POST(req) {
  try {
    const { userId, matchId } = await req.json();
    if (!validUserId(userId) || typeof matchId !== 'string' || !matchId || matchId.includes('/')) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const matchRef = adminDb.collection('gameMatches').doc(matchId);
    const userRef = adminDb.collection('users').doc(userId);

    const outcome = await adminDb.runTransaction(async (t) => {
      const [matchDoc, userDoc] = await Promise.all([t.get(matchRef), t.get(userRef)]);

      if (!matchDoc.exists) return { status: 404, error: 'Match not found' };
      const match = matchDoc.data();
      if (match.userId !== userId) return { status: 403, error: 'Match does not belong to this user' };
      if (match.used) return { status: 409, error: 'Match already claimed' };

      const now = Date.now();
      const elapsed = now - match.startedAtMs;
      if (elapsed < MIN_MATCH_MS) return { status: 400, error: 'Match was too short' };
      if (elapsed > MAX_MATCH_MS) return { status: 400, error: 'Match expired' };

      const user = userDoc.exists ? userDoc.data() : {};
      const paidExpiry = user.subscriptionExpiry || null;

      // A match can only be redeemed once, whatever the outcome.
      t.update(matchRef, { used: true, usedAtMs: now });

      if (ADMIN_USER_IDS.includes(userId) || user.unlimited === true) {
        return { body: { result: 'lifetime', subscriptionExpiry: 'LIFETIME' } };
      }

      const today = manilaDay(new Date(now));
      if (user.lastWinDay === today) {
        return { body: { result: 'already', subscriptionExpiry: paidExpiry } };
      }

      const current = paidExpiry ? new Date(paidExpiry) : null;
      const base = current && current.getTime() > now ? current : new Date(now);
      const newExpiry = new Date(base.getTime() + DAY_MS).toISOString();

      t.set(
        userRef,
        {
          subscriptionExpiry: newExpiry,
          isPremium: true,
          lastWinDay: today,
          lastWinAtMs: now,
          winBonusDays: (user.winBonusDays || 0) + 1,
        },
        { merge: true }
      );

      return { body: { result: 'granted', subscriptionExpiry: newExpiry } };
    });

    if (outcome.error) {
      return Response.json({ error: outcome.error }, { status: outcome.status });
    }
    return Response.json(outcome.body);
  } catch (err) {
    console.error('game-win error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

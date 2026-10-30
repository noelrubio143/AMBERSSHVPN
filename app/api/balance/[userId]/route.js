// NEW. GET /api/balance/:userId -> { balance }
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req, { params }) {
  try {
    const u = await adminDb.collection('users').doc(params.userId).get();
    return Response.json({ balance: u.exists ? u.data().balance ?? 0 : 0 });
  } catch (err) {
    console.error('balance error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

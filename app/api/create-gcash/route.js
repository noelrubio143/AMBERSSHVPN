// NEW. POST /api/create-gcash
//   { userId, months }  -> subscription plan (same price table as /create-payment)
//   { userId, amount }  -> any-amount top-up, credited to users/{userId}.balance
// Returns { paymentIntentId, checkoutUrl } — open checkoutUrl; GCash page asks for the number.
import { createGcashPayment, validateAmount } from '@/lib/gcash';
import { adminDb } from '@/lib/firebase-admin';

// Same pricing table as app/create-payment/route.js
const PRICING_TABLE = {
  1: 50, 2: 100, 3: 150, 4: 200, 5: 250, 6: 300,
  7: 350, 8: 400, 9: 450, 10: 500, 11: 550, 12: 600,
};

export async function POST(req) {
  try {
    const { userId, months, amount } = await req.json();
    if (!userId || typeof userId !== 'string') {
      return Response.json({ error: 'Missing userId' }, { status: 400 });
    }

    let amountPesos;
    let record;
    if (amount !== undefined && amount !== null) {
      try { amountPesos = validateAmount(amount); }
      catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
      record = { type: 'topup' };
    } else {
      if (!Number.isInteger(months) || !PRICING_TABLE[months]) {
        return Response.json({ error: 'Send either amount or a valid months (1-12)' }, { status: 400 });
      }
      amountPesos = PRICING_TABLE[months];
      record = { type: 'subscription', months };
    }

    const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
    const pay = await createGcashPayment({ userId, amountPesos, returnUrl: `${origin}/pay-return` });
    if (!pay.checkoutUrl) throw new Error('No checkout URL from PayMongo');

    await adminDb.collection('payments').doc(pay.paymentIntentId).set({
      userId,
      amount: amountPesos,
      ...record,
      paymentMethod: 'gcash',
      status: 'pending',
      granted: false,
      createdAt: new Date().toISOString(),
    });

    return Response.json({ paymentIntentId: pay.paymentIntentId, checkoutUrl: pay.checkoutUrl });
  } catch (err) {
    console.error('create-gcash error:', err);
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 });
  }
}

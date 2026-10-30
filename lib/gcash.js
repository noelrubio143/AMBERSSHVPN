// lib/gcash.js — NEW. PayMongo GCash e-wallet (redirect; user enters GCash number on GCash page, no QR).
// Supports a fixed plan (months) OR any custom amount (top-up).
const BASE = 'https://api.paymongo.com/v1';
const MIN_AMOUNT = Number(process.env.MIN_AMOUNT || 20);
const MAX_AMOUNT = Number(process.env.MAX_AMOUNT || 50000);

async function pm(path, body) {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error('Missing PAYMONGO_SECRET_KEY');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.errors?.[0]?.detail || 'PayMongo request failed');
  return json;
}

function validateAmount(raw) {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('Invalid amount');
  const pesos = Math.round(n * 100) / 100;
  if (pesos < MIN_AMOUNT) throw new Error(`Minimum amount is PHP ${MIN_AMOUNT}`);
  if (pesos > MAX_AMOUNT) throw new Error(`Maximum amount is PHP ${MAX_AMOUNT}`);
  return pesos;
}

async function createGcashPayment({ userId, amountPesos, returnUrl }) {
  const intent = await pm('/payment_intents', {
    data: { attributes: {
      amount: Math.round(amountPesos * 100),
      currency: 'PHP',
      payment_method_allowed: ['gcash'],
      capture_type: 'automatic',
    } },
  });
  const paymentIntentId = intent.data.id;

  const method = await pm('/payment_methods', {
    data: { attributes: {
      type: 'gcash',
      billing: {
        name: `User ${userId}`,
        email: `${userId}@ambersshvpn.app`,
        address: { line1: 'N/A', city: 'N/A', state: 'N/A', postal_code: '0000', country: 'PH' },
      },
    } },
  });

  const attached = await pm(`/payment_intents/${paymentIntentId}/attach`, {
    data: { attributes: {
      payment_method: method.data.id,
      return_url: `${returnUrl}?ref=${encodeURIComponent(paymentIntentId)}`,
    } },
  });

  return {
    paymentIntentId,
    checkoutUrl: attached.data.attributes?.next_action?.redirect?.url || null,
  };
}

module.exports = { createGcashPayment, validateAmount, MIN_AMOUNT, MAX_AMOUNT };

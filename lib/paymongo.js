// lib/paymongo.js
// Helper functions for talking to the PayMongo API (QR Ph payments)

const PAYMONGO_BASE_URL = 'https://api.paymongo.com/v1';

function getAuthHeader() {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing PAYMONGO_SECRET_KEY environment variable');
  }
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

async function paymongoRequest(path, body) {
  const res = await fetch(`${PAYMONGO_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    const message = json?.errors?.[0]?.detail || 'PayMongo request failed';
    throw new Error(message);
  }

  return json;
}

async function createPaymentIntent(amountInPesos) {
  const amountInCentavos = Math.round(amountInPesos * 100);

  if (amountInCentavos < 100) {
    throw new Error('Minimum amount is PHP 1.00');
  }

  return paymongoRequest('/payment_intents', {
    data: {
      attributes: {
        amount: amountInCentavos,
        currency: 'PHP',
        payment_method_allowed: ['qrph'],
        capture_type: 'automatic',
      },
    },
  });
}

async function createQrphPaymentMethod(billing) {
  return paymongoRequest('/payment_methods', {
    data: {
      attributes: {
        type: 'qrph',
        billing,
      },
    },
  });
}

async function attachPaymentMethod(paymentIntentId, paymentMethodId) {
  return paymongoRequest(`/payment_intents/${paymentIntentId}/attach`, {
    data: {
      attributes: {
        payment_method: paymentMethodId,
      },
    },
  });
}

async function createQrphPayment({ amount, name, email, phone, address }) {
  const intent = await createPaymentIntent(amount);
  const paymentIntentId = intent.data.id;

  const paymentMethod = await createQrphPaymentMethod({
    name,
    email,
    phone,
    address,
  });
  const paymentMethodId = paymentMethod.data.id;

  const attached = await attachPaymentMethod(paymentIntentId, paymentMethodId);

  const qrImageUrl = attached.data.attributes?.next_action?.code?.image_url;
  const status = attached.data.attributes?.status;

  if (!qrImageUrl) {
    throw new Error('QR Ph image was not returned by PayMongo');
  }

  return {
    paymentIntentId,
    qrImageUrl,
    status,
  };
}

module.exports = {
  createPaymentIntent,
  createQrphPaymentMethod,
  attachPaymentMethod,
  createQrphPayment,
};

// lib/payment-methods.js
// Handles GCash and Maya payment methods with QR codes

import QRCode from 'qrcode';
import crypto from 'crypto';

const GCASH_MERCHANT_ID = process.env.GCASH_MERCHANT_ID || '';
const MAYA_MERCHANT_ID = process.env.MAYA_MERCHANT_ID || '';
const MAYA_API_KEY = process.env.MAYA_API_KEY || '';

// Generate a unique reference number for transaction tracking
function generateReferenceNumber() {
  return `AMBER-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// GCash QR Code Payment
async function generateGCashQR(amount, userId, merchantName = 'AMBER VPN') {
  try {
    // GCash QR format: gcash://pay?amount=X.XX&name=MERCHANT&ref=REFERENCE
    const reference = generateReferenceNumber();
    const gcashUrl = `gcash://pay?amount=${amount.toFixed(2)}&name=${encodeURIComponent(merchantName)}&ref=${reference}&receiver=${GCASH_MERCHANT_ID}`;
    
    // Generate QR code as data URL (PNG)
    const qrDataUrl = await QRCode.toDataURL(gcashUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return {
      reference,
      qrCodeImage: qrDataUrl,
      gcashUrl,
      type: 'gcash',
      amount,
      merchantId: GCASH_MERCHANT_ID,
    };
  } catch (err) {
    throw new Error(`Failed to generate GCash QR: ${err.message}`);
  }
}

// Maya Payment Method
async function generateMayaPaymentLink(amount, userId, description = 'AMBER VPN Subscription') {
  try {
    const reference = generateReferenceNumber();
    
    // Maya requires API call to create payment session
    const mayaPayload = {
      requestReferenceNumber: reference,
      amount: {
        value: amount,
        currency: 'PHP',
      },
      description,
      buyer: {
        firstName: `User`,
        lastName: userId,
        email: `${userId}@amber.local`,
        phone: '09000000000',
        middleName: '',
      },
      metadata: {
        userId,
        type: 'subscription',
        app: 'AMBER',
      },
    };

    // In production, call Maya API here:
    // const mayaResponse = await fetch('https://pg.paymaya.com/api/v1/checkout/sessions', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${MAYA_API_KEY}:`).toString('base64')}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(mayaPayload),
    // });
    // const mayaData = await mayaResponse.json();
    
    // For now, return mock Maya payment session
    const mayaSessionId = `maya-${reference}`;
    const mayaCheckoutUrl = `https://pg.paymaya.com/checkout/${mayaSessionId}`;

    return {
      reference,
      mayaSessionId,
      checkoutUrl: mayaCheckoutUrl,
      type: 'maya',
      amount,
      username: MAYA_MERCHANT_ID,
      // Password field will be handled client-side with secure storage
      credentialsRequired: true,
    };
  } catch (err) {
    throw new Error(`Failed to generate Maya payment link: ${err.message}`);
  }
}

// Verify GCash payment (check transaction status)
async function verifyGCashPayment(reference) {
  try {
    // In production, query GCash API or webhook data from Firestore
    // For now, this is a placeholder that would check your transaction log
    return {
      reference,
      status: 'pending', // pending, completed, failed
      isPaid: false,
    };
  } catch (err) {
    throw new Error(`Failed to verify GCash payment: ${err.message}`);
  }
}

// Verify Maya payment (check transaction status)
async function verifyMayaPayment(mayaSessionId, reference) {
  try {
    // In production, call Maya API to check payment status
    // const mayaResponse = await fetch(`https://pg.paymaya.com/api/v1/checkout/sessions/${mayaSessionId}`, {
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${MAYA_API_KEY}:`).toString('base64')}`,
    //   },
    // });
    // const mayaData = await mayaResponse.json();
    
    return {
      reference,
      mayaSessionId,
      status: 'pending', // pending, completed, failed
      isPaid: false,
    };
  } catch (err) {
    throw new Error(`Failed to verify Maya payment: ${err.message}`);
  }
}

export {
  generateGCashQR,
  generateMayaPaymentLink,
  verifyGCashPayment,
  verifyMayaPayment,
  generateReferenceNumber,
};

'use client';
// app/pay/page.js
// Payment page with QR Ph, GCash, and Maya options

import { useState } from 'react';

export default function PayPage() {
  const [userId, setUserId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [reference, setReference] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle QR Ph Payment
  async function handleQRPh() {
    if (!userId) {
      setError('Please enter User ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/create-qrph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: 50,
          name: `User ${userId}`,
          email: `${userId}@amber.local`,
          phone: '09000000000',
          address: {
            line1: 'N/A',
            city: 'N/A',
            state: 'N/A',
            postal_code: '0000',
            country: 'PH',
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create QR Ph payment');
      }

      setPaymentMethod('qrph');
      setQrImageUrl(data.qrImageUrl);
      setReference(data.paymentIntentId);
      setStatus('Pending - Scan QR code within 10 minutes');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle GCash Payment
  // NOTE (Option B): GCash button does NOT create a separate GCash payment
  // intent anymore. It reuses the same PayMongo QR Ph flow as the QR Ph
  // button, since QR Ph is a universal PH QR standard that GCash's own
  // "Scan QR" feature can read. Only the label/instructions differ.
  async function handleGCash() {
    if (!userId) {
      setError('Please enter User ID');
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentMethod('gcash'); // controls which label/instructions render

    try {
      const res = await fetch('/api/create-qrph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: 50,
          name: `User ${userId}`,
          email: `${userId}@amber.local`,
          phone: '09000000000',
          address: {
            line1: 'N/A',
            city: 'N/A',
            state: 'N/A',
            postal_code: '0000',
            country: 'PH',
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      setQrImageUrl(data.qrImageUrl);
      setReference(data.paymentIntentId);
      setStatus('Buksan ang GCash app mo → Scan QR → i-scan ang code sa ibaba (QR Ph)');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle Maya Payment
  // NOTE (Option B): same as GCash above — reuses the QR Ph payment intent
  // instead of the separate (mock) Maya checkout session. QR Ph is readable
  // by Maya's "Scan QR to Pay" feature too.
  async function handleMaya() {
    if (!userId) {
      setError('Please enter User ID');
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentMethod('maya'); // controls which label/instructions render

    try {
      const res = await fetch('/api/create-qrph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: 50,
          name: `User ${userId}`,
          email: `${userId}@amber.local`,
          phone: '09000000000',
          address: {
            line1: 'N/A',
            city: 'N/A',
            state: 'N/A',
            postal_code: '0000',
            country: 'PH',
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create payment');
      }

      setQrImageUrl(data.qrImageUrl);
      setReference(data.paymentIntentId);
      setStatus('Buksan ang Maya app mo → Scan QR → i-scan ang code sa ibaba (QR Ph)');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Check Payment Status
  async function checkPaymentStatus() {
    if (!reference) {
      setError('No payment reference found');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/check-payment-status/${reference}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to check status');
      }

      setStatus(`Status: ${data.status} - Granted: ${data.granted ? 'YES' : 'NO'}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', fontFamily: 'sans-serif', padding: 20 }}>
      <h1>💳 Payment Methods</h1>

      {/* User ID Input */}
      {!paymentMethod && (
        <>
          <input
            type="text"
            placeholder="Enter User ID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              marginBottom: 16,
              padding: 10,
              fontSize: 14,
              borderRadius: 4,
              border: '1px solid #ccc',
              boxSizing: 'border-box',
            }}
          />

          {/* Payment Method Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <button
              onClick={handleQRPh}
              disabled={loading || !userId}
              style={{
                padding: 15,
                fontSize: 14,
                fontWeight: 'bold',
                backgroundColor: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: loading || !userId ? 0.5 : 1,
              }}
            >
              {loading && paymentMethod === 'qrph' ? '⏳' : '📱'} QR Ph
            </button>

            <button
              onClick={handleGCash}
              disabled={loading || !userId}
              style={{
                padding: 15,
                fontSize: 14,
                fontWeight: 'bold',
                backgroundColor: '#0066FF',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: loading || !userId ? 0.5 : 1,
              }}
            >
              {loading && paymentMethod === 'gcash' ? '⏳' : '💰'} GCash
            </button>

            <button
              onClick={handleMaya}
              disabled={loading || !userId}
              style={{
                padding: 15,
                fontSize: 14,
                fontWeight: 'bold',
                backgroundColor: '#FF6B00',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: loading || !userId ? 0.5 : 1,
              }}
            >
              {loading && paymentMethod === 'maya' ? '⏳' : '🏦'} Maya
            </button>
          </div>
        </>
      )}

      {/* QR Code Display (shared by QR Ph, GCash, and Maya buttons) */}
      {qrImageUrl && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h3>
            {paymentMethod === 'gcash'
              ? 'Scan gamit ang GCash'
              : paymentMethod === 'maya'
              ? 'Scan gamit ang Maya'
              : 'QR Ph Code'}
          </h3>
          <img
            src={qrImageUrl}
            alt="Payment QR"
            style={{ width: '100%', maxWidth: 250, marginBottom: 16, border: '1px solid #ddd', borderRadius: 4 }}
          />
          {(paymentMethod === 'gcash' || paymentMethod === 'maya') && (
            <p style={{ fontSize: 12, color: '#888', marginTop: -8, marginBottom: 12 }}>
              Isa itong QR Ph code — nababasa ng "Scan QR" feature ng {paymentMethod === 'gcash' ? 'GCash' : 'Maya'} app, kaya hindi na kailangan ng hiwalay na payment method.
            </p>
          )}
          <p style={{ fontSize: 12, color: '#666' }}>Reference: {reference}</p>
        </div>
      )}

      {/* Maya Checkout Link — kept for older flow; unused now that Maya
          button reuses the QR Ph image above, but left in case checkoutUrl
          is ever set from elsewhere. */}
      {checkoutUrl && (
        <div style={{ textAlign: 'center', marginBottom: 20, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
          <h3>Maya Checkout</h3>
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#FF6B00',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 4,
              fontWeight: 'bold',
              marginBottom: 10,
            }}
          >
            Open Maya Checkout →
          </a>
          <p style={{ fontSize: 12, color: '#666' }}>Reference: {reference}</p>
        </div>
      )}

      {/* Status Display */}
      {status && (
        <div
          style={{
            padding: 12,
            backgroundColor: '#e8f4f8',
            border: '1px solid #0066FF',
            borderRadius: 4,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <strong>Status:</strong> {status}
        </div>
      )}

      {/* Check Status Button */}
      {reference && (
        <button
          onClick={checkPaymentStatus}
          disabled={loading}
          style={{
            display: 'block',
            width: '100%',
            padding: 10,
            marginBottom: 16,
            backgroundColor: '#34C759',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Checking...' : 'Check Payment Status'}
        </button>
      )}

      {/* Reset Button */}
      {paymentMethod && (
        <button
          onClick={() => {
            setPaymentMethod(null);
            setQrImageUrl(null);
            setCheckoutUrl(null);
            setReference(null);
            setStatus(null);
            setError(null);
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: 10,
            backgroundColor: '#999',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Back to Payment Methods
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: 12,
            backgroundColor: '#ffe8e8',
            border: '1px solid #FF3B30',
            borderRadius: 4,
            color: '#FF3B30',
            marginTop: 16,
            fontSize: 14,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}

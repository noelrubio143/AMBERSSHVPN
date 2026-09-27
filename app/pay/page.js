'use client';
// app/pay/page.js
// Payment page with pricing tiers (1-12 months) and QR Ph, GCash, and Maya options

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
  const [selectedMonths, setSelectedMonths] = useState(null);

  // Pricing tiers: 50 per month (₱50 for 1mo, ₱100 for 2mo, etc.)
  const pricingTiers = [
    { months: 1, price: 50 },
    { months: 2, price: 100 },
    { months: 3, price: 150 },
    { months: 4, price: 200 },
    { months: 5, price: 250 },
    { months: 6, price: 300 },
    { months: 7, price: 350 },
    { months: 8, price: 400 },
    { months: 9, price: 450 },
    { months: 10, price: 500 },
    { months: 11, price: 550 },
    { months: 12, price: 600 },
  ];

  // Handle QR Ph Payment
  async function handleQRPh() {
    if (!userId) {
      setError('Please enter User ID');
      return;
    }

    if (!selectedMonths) {
      setError('Please select a subscription plan');
      return;
    }

    setLoading(true);
    setError(null);

    const selectedTier = pricingTiers.find(t => t.months === selectedMonths);

    try {
      const res = await fetch('/api/create-qrph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: selectedTier.price,
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
      setStatus(`Scan to All eWallet - ₱${selectedTier.price} (${selectedMonths} month${selectedMonths > 1 ? 's' : ''})`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle GCash Payment
  async function handleGCash() {
    if (!userId) {
      setError('Please enter User ID');
      return;
    }

    if (!selectedMonths) {
      setError('Please select a subscription plan');
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentMethod('gcash');

    const selectedTier = pricingTiers.find(t => t.months === selectedMonths);

    try {
      const res = await fetch('/api/create-qrph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: selectedTier.price,
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
      setStatus(`Scan to GCash - ₱${selectedTier.price} (${selectedMonths} month${selectedMonths > 1 ? 's' : ''})`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Handle Maya Payment
  async function handleMaya() {
    if (!userId) {
      setError('Please enter User ID');
      return;
    }

    if (!selectedMonths) {
      setError('Please select a subscription plan');
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentMethod('maya');

    const selectedTier = pricingTiers.find(t => t.months === selectedMonths);

    try {
      const res = await fetch('/api/create-qrph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: selectedTier.price,
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
      setStatus(`Scan to Maya - ₱${selectedTier.price} (${selectedMonths} month${selectedMonths > 1 ? 's' : ''})`);
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
      <h1>💳 VPN Subscription</h1>

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

          {/* Pricing Tiers Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 10, fontWeight: 'bold', fontSize: 14 }}>
              Select Subscription Duration:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {pricingTiers.map((tier) => (
                <button
                  key={tier.months}
                  onClick={() => setSelectedMonths(tier.months)}
                  style={{
                    padding: 12,
                    fontSize: 12,
                    fontWeight: 'bold',
                    backgroundColor: selectedMonths === tier.months ? '#007AFF' : '#f0f0f0',
                    color: selectedMonths === tier.months ? 'white' : '#333',
                    border: selectedMonths === tier.months ? '2px solid #0051CC' : '1px solid #ddd',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {tier.months}mo <br /> ₱{tier.price}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Duration Display */}
          {selectedMonths && (
            <div style={{
              padding: 12,
              backgroundColor: '#e8f4f8',
              border: '1px solid #0066FF',
              borderRadius: 4,
              marginBottom: 16,
              fontSize: 14,
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              Selected: {selectedMonths} month{selectedMonths > 1 ? 's' : ''} - ₱{pricingTiers.find(t => t.months === selectedMonths)?.price}
            </div>
          )}

          {/* Payment Method Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <button
              onClick={handleQRPh}
              disabled={loading || !userId || !selectedMonths}
              style={{
                padding: 15,
                fontSize: 12,
                fontWeight: 'bold',
                backgroundColor: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: loading || !userId || !selectedMonths ? 0.5 : 1,
              }}
            >
              {loading && paymentMethod === 'qrph' ? '⏳' : '📱'} All eWallet
            </button>

            <button
              onClick={handleGCash}
              disabled={loading || !userId || !selectedMonths}
              style={{
                padding: 15,
                fontSize: 12,
                fontWeight: 'bold',
                backgroundColor: '#0066FF',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: loading || !userId || !selectedMonths ? 0.5 : 1,
              }}
            >
              {loading && paymentMethod === 'gcash' ? '⏳' : '💰'} GCash
            </button>

            <button
              onClick={handleMaya}
              disabled={loading || !userId || !selectedMonths}
              style={{
                padding: 15,
                fontSize: 12,
                fontWeight: 'bold',
                backgroundColor: '#FF6B00',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                opacity: loading || !userId || !selectedMonths ? 0.5 : 1,
              }}
            >
              {loading && paymentMethod === 'maya' ? '⏳' : '🏦'} Maya
            </button>
          </div>
        </>
      )}

      {/* QR Code Display */}
      {qrImageUrl && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h3>
            {paymentMethod === 'gcash'
              ? 'Scan gamit ang GCash'
              : paymentMethod === 'maya'
              ? 'Scan gamit ang Maya'
              : 'All eWallet QR Code'}
          </h3>
          <img
            src={qrImageUrl}
            alt="Payment QR"
            style={{ width: '100%', maxWidth: 250, marginBottom: 16, border: '1px solid #ddd', borderRadius: 4 }}
          />
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
            setSelectedMonths(null);
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

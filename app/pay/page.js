'use client';
// app/pay/page.js
// Simple example page: form -> QR Ph code -> live status via Firestore

import { useState } from 'react';

export default function PayPage() {
  const [form, setForm] = useState({ amount: '', name: '', email: '', phone: '' });
  const [qrImageUrl, setQrImageUrl] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setQrImageUrl(null);

    try {
      const res = await fetch('/api/create-qrph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          name: form.name,
          email: form.email,
          phone: form.phone,
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
      setStatus('pending — scan the QR code within 10 minutes');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Bayad gamit QR Ph</h1>

      {!qrImageUrl && (
        <form onSubmit={handleSubmit}>
          <input
            type="number"
            placeholder="Amount (PHP)"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
          />
          <input
            type="text"
            placeholder="Full name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
          />
          <input
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }}
          />
          <button type="submit" disabled={loading} style={{ padding: 10, width: '100%' }}>
            {loading ? 'Gumagawa ng QR...' : 'Gumawa ng QR Ph code'}
          </button>
        </form>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {qrImageUrl && (
        <div style={{ textAlign: 'center' }}>
          <img src={qrImageUrl} alt="QR Ph code" style={{ width: '100%', maxWidth: 300 }} />
          <p>{status}</p>
        </div>
      )}
    </div>
  );
}

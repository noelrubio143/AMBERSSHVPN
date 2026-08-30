# AMBERSSHVPN Payment Backend

A serverless payment processing backend for AMBERSSHVPN built with Express.js, Firebase, and PayMongo. Designed to run on Vercel.

## Features

- 🚀 **Serverless** - Deploy to Vercel with zero maintenance
- 💳 **PayMongo Integration** - QR Ph (GCash) payment support
- 🔐 **Firebase Backend** - Secure user data storage
- 📱 **Mobile Ready** - CORS-enabled for mobile apps
- 🔔 **Webhook Support** - Real-time payment notifications
- ✨ **Production Ready** - Error handling, logging, transaction safety

## API Endpoints

### Create Payment
```
POST /api/create-payment
Body: { userId: "user123" }
Returns: { paymentIntentId, status, qrCodeImage }
```

### Check Payment Status
```
GET /api/check-payment/:id
Returns: { paymentIntentId, paymongoStatus, granted, subscriptionExpiry }
```

### Get User Status
```
GET /api/user-status/:userId
Returns: { isPremium, subscriptionExpiry, active }
```

### Health Check
```
GET /api/health
Returns: { status, time }
```

### Webhook
```
POST /api/webhook
(PayMongo sends payment events here)
```

## Quick Start

### 1. Setup

```bash
# Clone or download this repo
git clone <your-repo-url>
cd amberssh-backend

# Install dependencies
npm install
```

### 2. Environment Setup

```bash
# Copy example to local env
cp .env.example .env.local

# Edit .env.local with your credentials
# - FIREBASE_SERVICE_ACCOUNT (Firebase JSON)
# - PAYMONGO_SECRET_KEY (PayMongo Secret Key)
```

### 3. Local Development

```bash
npm run dev
# Server runs on http://localhost:3000
```

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel

# Follow prompts and set environment variables in Vercel dashboard
```

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed deployment instructions.

## Architecture

```
┌─────────────────────┐
│   Mobile App        │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────────┐
│  Vercel (Serverless)    │
│  api/index.js           │
└──────────┬──────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐  ┌──────────────┐
│Firebase │  │  PayMongo    │
│Firestore│  │  API         │
└─────────┘  └──────────────┘
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | Firebase admin JSON (as string) |
| `PAYMONGO_SECRET_KEY` | ✅ | PayMongo API secret key |
| `SUBSCRIPTION_PRICE_CENTAVOS` | ❌ | Price in centavos (default: 9900) |
| `SUCCESS_REDIRECT_URL` | ❌ | URL after successful payment |
| `FAILED_REDIRECT_URL` | ❌ | URL after failed payment |

## Security

- ✅ Raw body parsing for webhook signature verification
- ✅ CORS enabled for trusted origins
- ✅ Firebase Firestore transactions prevent race conditions
- ✅ Environment variables for all secrets (no hardcoding)
- ✅ Webhook idempotency (duplicate events won't grant double subscriptions)

## Payment Flow

1. User taps "Subscribe" in app
2. App calls `POST /api/create-payment` → Gets QR code image
3. User scans QR with GCash/e-wallet
4. User completes payment
5. PayMongo sends webhook to `/api/webhook`
6. Backend grants 1-month subscription in Firebase
7. App polls `GET /api/check-payment/:id` → Sees payment granted
8. App updates UI and allows VPN access

## File Structure

```
amberssh-backend/
├── api/
│   └── index.js              # Main serverless handler
├── package.json              # Dependencies
├── vercel.json              # Vercel config
├── .env.example             # Environment template
├── VERCEL_SETUP.md          # Deployment guide
└── README.md                # This file
```

## Dependencies

- **express** - Web framework
- **axios** - HTTP client for PayMongo API
- **firebase-admin** - Firebase SDK
- **cors** - Cross-origin support
- **dotenv** - Environment variables
- **serverless-http** - Express to serverless adapter

## Deployment

### To Vercel

```bash
npm install -g vercel
vercel
```

### To Other Platforms

This also works on:
- ✅ Railway
- ✅ Render
- ✅ Netlify Functions
- ✅ AWS Lambda
- ✅ Google Cloud Functions
- ✅ Docker/Self-hosted

## Monitoring

### Vercel Dashboard
- View deployment logs
- Check function execution time
- Monitor bandwidth usage

### Firebase Console
- View Firestore collections
- Check payment records
- Monitor real-time database

### PayMongo Dashboard
- View transaction logs
- Check webhook delivery status
- Monitor failed payments

## Troubleshooting

**App can't connect to backend?**
- Verify Vercel URL is correct
- Check CORS origins in code
- Ensure environment variables are set

**Payments not being granted?**
- Check webhook URL in PayMongo
- Verify Firebase credentials
- Check Vercel logs for errors

**QR code not displaying?**
- Ensure PayMongo secret key is correct
- Check response from `/api/create-payment`
- Look for errors in app console

## Development

### Add Logging
```javascript
console.log('Payment created:', paymentIntentId);
```

### Add New Endpoint
```javascript
app.post('/api/new-endpoint', async (req, res) => {
  try {
    // Your logic here
    res.json({ success: true });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
```

### Redeploy
```bash
git add .
git commit -m "Update backend"
git push
# Vercel automatically redeploys!
```

## License

MIT

## Support

- 📖 [Vercel Docs](https://vercel.com/docs)
- 🔥 [Firebase Docs](https://firebase.google.com/docs)
- 💳 [PayMongo API](https://developers.paymongo.com)

---

Made for AMBERSSHVPN 🚀

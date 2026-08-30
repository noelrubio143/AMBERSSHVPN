# AMBERSSHVPN Payment Backend - Vercel Deployment Guide

This guide will walk you through deploying your payment backend to Vercel.

## Prerequisites

1. **Vercel Account** - Free tier is sufficient
   - Sign up at https://vercel.com
   
2. **GitHub Account** - Recommended for easy deployment
   - Sign up at https://github.com
   
3. **PayMongo Account** - For payment processing
   - Get API keys from https://dashboard.paymongo.com
   
4. **Firebase Project** - For user data storage
   - Create at https://console.firebase.google.com

## Step 1: Prepare Your Repository

### Option A: Create a New Repository (Recommended)

```bash
# Create new directory
mkdir amberssh-backend
cd amberssh-backend

# Initialize git
git init

# Copy these files to your project:
# - api/index.js (from vercel-api-index.js)
# - package.json
# - vercel.json
# - .env.example
# - README.md (if you want)
```

### Option B: Use Existing Repository

If you have an existing repo, just add the `api/` folder with the files above.

## Step 2: Set Up File Structure

Your project should look like this:

```
amberssh-backend/
├── api/
│   └── index.js              (from vercel-api-index.js)
├── package.json
├── vercel.json
├── .env.example
├── .gitignore
└── README.md (optional)
```

## Step 3: Create `.gitignore`

```bash
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.env.*.local
dist/
build/
*.log
.DS_Store
EOF
```

## Step 4: Push to GitHub

```bash
# Add all files
git add .

# Commit
git commit -m "Initial AMBERSSHVPN payment backend setup for Vercel"

# Add remote (replace YOUR_USERNAME and YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 5: Connect to Vercel

### Using Vercel CLI (Easiest)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Deploy
vercel
```

Follow the prompts:
- Select "Y" to create a new project
- Choose your organization
- Enter project name: `amberssh-backend`
- Framework: `Other` (or `Node.js`)
- Root directory: `./` (default)

### Using Vercel Web Dashboard

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Select your GitHub repository
4. Click "Import"
5. Continue to environment variables setup (Step 6)

## Step 6: Set Environment Variables in Vercel

After importing your project:

### Get Your Credentials

#### Firebase Service Account JSON

1. Go to **Firebase Console** → Your Project → **Settings** ⚙️
2. Go to **Service Accounts** tab
3. Click **Generate New Private Key**
4. You'll get a JSON file. Convert it to a single-line string:

```bash
# On Mac/Linux - this removes newlines and formats it correctly
cat your-firebase-key.json | tr '\n' ' '
```

5. Copy the entire output

#### PayMongo Secret Key

1. Go to **PayMongo Dashboard** → **API Keys** (or Account Settings)
2. Copy your **Secret Key** (looks like `sk_live_...`)

### Set in Vercel

1. In Vercel dashboard, go to your project's **Settings** tab
2. Go to **Environment Variables**
3. Add these variables:

| Key | Value | Environment |
|-----|-------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Your Firebase JSON (as single-line string) | Production, Preview, Development |
| `PAYMONGO_SECRET_KEY` | Your PayMongo Secret Key | Production, Preview, Development |
| `SUBSCRIPTION_PRICE_CENTAVOS` | `9900` (PHP 99.00) | Production, Preview, Development |
| `SUCCESS_REDIRECT_URL` | `https://noelrubio143.github.io/AMBERSSHVPN/payment-success.html` | Production, Preview, Development |
| `FAILED_REDIRECT_URL` | `https://noelrubio143.github.io/AMBERSSHVPN/payment-failed.html` | Production, Preview, Development |

4. Click "Save"

5. Redeploy your project for variables to take effect:
   - Go to **Deployments** tab
   - Click "..." on latest deployment
   - Select **Redeploy**

## Step 7: Verify Deployment

Once deployed, Vercel will give you a URL (like `https://amberssh-backend.vercel.app`).

Test your endpoints:

```bash
# Test health endpoint
curl https://your-vercel-url.vercel.app/api/health

# Expected response:
# {"status":"ok","time":"2024-08-29T..."}
```

## Step 8: Update Your App Configuration

In your AMBERSSHVPN app, update the backend API URL:

```javascript
// Change from:
const API_URL = 'https://render-backend.onrender.com';

// To:
const API_URL = 'https://your-vercel-url.vercel.app';
```

## Step 9: Configure PayMongo Webhook

1. Go to **PayMongo Dashboard** → **Webhooks**
2. Add a new webhook:
   - **Event Type**: Select all payment events
     - `payment_intent.succeeded`
     - `source.chargeable`
     - `payment.paid`
   - **Endpoint URL**: `https://your-vercel-url.vercel.app/api/webhook`
3. Save

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT is not defined"
- Make sure the environment variable is set in Vercel
- Redeploy after adding it
- Check it's not enclosed in quotes in Vercel dashboard

### "PayMongo API Key not working"
- Verify you're using the **Secret Key**, not the Public Key
- Check the key starts with `sk_live_` or `sk_test_`
- Make sure there are no extra spaces

### "CORS Error in App"
- The server already has CORS enabled for common origins
- If needed, add your domain to the `corsOptions` in `api/index.js`
- Redeploy after making changes

### "Function Timeout"
- If functions timeout, Vercel already allocated 3GB memory and 60 second timeout
- Consider optimizing Firebase queries

### "Webhook Not Firing"
- Verify webhook URL is exactly: `https://your-vercel-url.vercel.app/api/webhook`
- Check PayMongo dashboard logs for webhook delivery status
- Test with PayMongo's webhook test tool

## Local Development

To test locally before deploying:

```bash
# Install dependencies
npm install

# Create .env.local with your credentials (copy from .env.example)
cp .env.example .env.local
# Edit .env.local with your actual values

# Start development server
npm run dev

# Server will run on http://localhost:3000
```

Test endpoints:
```bash
curl http://localhost:3000/api/health
```

## Updating Your Backend

To make changes:

```bash
# Make your changes to api/index.js
# Commit and push
git add .
git commit -m "Update payment backend"
git push

# Vercel automatically redeploys on push!
```

## Cost

**Vercel Free Tier includes:**
- ✅ Unlimited deployments
- ✅ Up to 100 GB bandwidth per month
- ✅ Serverless functions
- ✅ 12 concurrent executions

This is **more than enough** for a payment backend.

## Security Best Practices

1. ✅ Never commit `.env` or credentials to GitHub
2. ✅ Use Vercel's environment variables, not `.env` files in production
3. ✅ Keep your Firebase service account key secure
4. ✅ Use different API keys for development vs. production (PayMongo offers this)
5. ✅ Enable webhook signature verification (optional but recommended)

## Support

- Vercel Docs: https://vercel.com/docs
- Firebase Admin SDK: https://firebase.google.com/docs/database/admin/start
- PayMongo API: https://developers.paymongo.com/reference
- Express.js: https://expressjs.com/

## Next Steps

1. Deploy to Vercel (follow steps above)
2. Test payment flow in your app
3. Monitor logs in Vercel dashboard
4. Set up Firebase Firestore backups
5. Consider adding analytics/monitoring

---

**Questions?** Check the Vercel dashboard logs (under Deployments → Logs) for error messages.

# Amber Payment Backend

Simpleng Node.js/Express server na:
1. Gumagawa ng PayMongo QRPh payment link (`POST /create-payment`)
2. Tumatanggap ng webhook mula sa PayMongo kapag nabayaran na (`POST /webhook`)
3. Awtomatikong nagdadagdag ng **30 araw** sa `subscriptionExpiry` ng user sa Firestore

Walang kailangang credit card - gumagana ito sa Render.com free tier at
Firebase Spark (free) plan.

---

## PAANO I-DEPLOY (step by step)

### 1. I-upload ang mga files na ito sa isang bagong GitHub repo

Gumawa ng bagong repo sa GitHub (hal. `amber-payment-backend`), i-upload
lahat ng files sa folder na ito (huwag isama ang `.env` kung meron ka man
nito - protektado na ito ng `.gitignore`).

### 2. Kunin ang Firebase Service Account key

1. Pumunta sa **Firebase Console** > piliin ang `amber-chat` project
2. Gear icon > **Project settings** > tab na **Service accounts**
3. I-click ang **"Generate new private key"** - magda-download ito ng
   `.json` file
4. Buksan ang file, kopyahin ang BUONG laman nito (mula `{` hanggang `}`)

### 3. Kunin ang PayMongo Secret Key

1. Pumunta sa **PayMongo Dashboard** > **Developers** > **API Keys**
2. Kopyahin ang **Secret Key** (gamitin muna ang TEST key: `sk_test_...`)

### 4. Gumawa ng Web Service sa Render

1. Sa Render dashboard, **New Web Service** > piliin ang GitHub repo na
   ginawa mo sa step 1
2. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. Sa ilalim ng **Environment Variables**, idagdag ang mga sumusunod:

   | Key | Value |
   |---|---|
   | `PAYMONGO_SECRET_KEY` | yung sk_test_... mula step 3 |
   | `FIREBASE_SERVICE_ACCOUNT` | yung buong JSON mula step 2 (isang linya lang) |
   | `SUBSCRIPTION_PRICE_CENTAVOS` | `9900` (para sa P99.00) |
   | `SUCCESS_REDIRECT_URL` | link papunta sa success page mo |
   | `FAILED_REDIRECT_URL` | link papunta sa failed page mo |

4. I-click ang **"Create Web Service"** - maghihintay ka ng ilang minuto
   habang nagbi-build

5. Kapag tapos na, may makukuhang URL ka tulad ng:
   `https://amber-payment-backend.onrender.com`

### 5. I-configure ang Webhook sa PayMongo

1. Sa PayMongo Dashboard > **Developers** > **Webhooks**
2. **Add endpoint**
3. URL: `https://amber-payment-backend.onrender.com/webhook`
4. Piliin ang mga events: `source.chargeable` at `payment.paid`
5. I-save

### 6. Testing

Puwede mong i-test agad gamit ang `curl` o Postman:

```bash
curl -X POST https://amber-payment-backend.onrender.com/create-payment \
  -H "Content-Type: application/json" \
  -d '{"userId": "TEST_USER_ID_123"}'
```

Dapat may ibalik na `checkoutUrl` - buksan mo iyon sa browser, magpanggap
kang magbayad gamit ang PayMongo TEST mode (hindi totoong pera), tapos
i-check mo sa Firestore Console kung na-update ang
`users/TEST_USER_ID_123` document.

---

## PAALALA

- **Free tier ng Render "sleeps" pagkatapos ng ~15 minuto ng inactivity.**
  Kapag walang gumagamit, matutulog ang server at may 30-60 segundong
  delay sa unang request pagkagising. Normal lang ito sa free tier.
- Gamitin muna ang PayMongo **TEST mode** (`sk_test_...`) hangga't
  hindi pa fully tested. Palitan lang sa `sk_live_...` sa Render
  environment variables kapag handa ka nang tumanggap ng totoong bayad.
- Kailangan mong munang ma-activate/ma-approve ang **QRPh** sa PayMongo
  account mo bago gumana ang `type: 'qrph'` sa `/create-payment`.

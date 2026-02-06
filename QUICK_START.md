# Quick Start: Paystack Integration Testing

Get the bot running with Paystack in **5 minutes**.

## Prerequisites
- Node.js 14+
- PostgreSQL 12+
- Redis 6+
- ngrok (for local webhook testing)
- Paystack test account (free)

## Step 1: Get Paystack Keys (2 min)

1. Sign up: https://paystack.com
2. Go to Settings → API Keys & Webhooks
3. Copy **Test** keys:
   - `pk_test_xxxxx...` (Public)
   - `sk_test_xxxxx...` (Secret)

## Step 2: Configure Environment (1 min)

```bash
cp .env.example .env
```

Edit `.env`:
```bash
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxx
```

## Step 3: Setup Webhook with ngrok (1 min)

Terminal 1:
```bash
npm install
npm start
```

Terminal 2:
```bash
./ngrok http 3000
# Copy the URL: https://xxxxx.ngrok.io
```

## Step 4: Register Webhook in Paystack (1 min)

1. Go to Paystack Dashboard → Settings → Webhooks
2. Add webhook: `https://xxxxx.ngrok.io/paystack-webhook`
3. Enable events:
   - charge.success
   - subscription.create
   - charge.failed

## Step 5: Test the Flow (1 min)

**In WhatsApp (or test via curl):**

```bash
# 1. User requests subscription
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "234xxxxxxxxxx",
            "text": {"body": "subscribe"}
          }]
        }
      }]
    }]
  }'

# 2. Bot sends payment link
# User clicks and completes payment with test card: 4111 1111 1111 1111
# Paystack sends webhook
# Bot receives webhook → Updates DB → Sends confirmation
```

## Test Cards

| Card | Expiry | CVV | Result |
|------|--------|-----|--------|
| 4111 1111 1111 1111 | Any | Any 3 digits | ✅ Success |
| 5555 5555 5555 4444 | Any | Any 3 digits | ✅ Success |

## Verify Success

```bash
# Check database
psql -U jamb_user -d jamb_bot

SELECT phone_number, subscription_status, subscription_plan, expiry_date 
FROM users 
WHERE subscription_status = 'active';
```

Expected output:
```
phone_number  | subscription_status | subscription_plan | expiry_date
234xxxxxxxxx  | active              | 1_month           | 2026-03-06 ...
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Paystack secret not configured" | Check `PAYSTACK_SECRET_KEY` in `.env` |
| Webhook not received | Verify ngrok URL in Paystack dashboard |
| Invalid signature | Ensure correct secret key used |
| Database error | Run `npm run db:init` or `psql -U jamb_user -d jamb_bot -f db/init.sql` |

## Next Steps

- Read [PAYSTACK_INTEGRATION.md](./PAYSTACK_INTEGRATION.md) for full documentation
- Enable more webhook events for production
- Add email notifications
- Set up analytics dashboard
- Configure rate limiting
- Move to live keys when ready

## Useful Commands

```bash
# Start bot
npm start

# Run ngrok
./ngrok http 3000

# Check webhook logs
tail -f logs/paystack.log

# Test webhook manually (requires jq)
curl -s http://localhost:3000/health | jq

# Database commands
psql -U jamb_user -d jamb_bot -c "SELECT * FROM users WHERE subscription_status='active';"
```

## Environment Variables

```bash
# Minimal setup
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
WHATSAPP_TOKEN=your_token
PHONE_NUMBER_ID=your_id
VERIFY_TOKEN=change_me

# Optional
NGROK_URL=https://xxxxx.ngrok.io
NODE_ENV=development
```

## Time Estimate

- Initial setup: 5-10 minutes
- First test payment: 2-3 minutes
- Integration complete: 10-15 minutes total

**Ready? Let's go!** 🚀

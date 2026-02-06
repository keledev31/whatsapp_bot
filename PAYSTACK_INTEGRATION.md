# Paystack Integration Guide - WhatsApp Bot

This document provides comprehensive instructions for integrating and testing Paystack payment processing for the WhatsApp Bot premium subscription system.

## Overview

The WhatsApp Bot now includes full Paystack integration for:
- **Phone-based authentication**: Uses WhatsApp phone number as unique identifier (no passwords)
- **Subscription management**: Monthly, 3-month, and lifetime plans with PostgreSQL tracking
- **Webhook verification**: HMAC-SHA512 signature verification for secure payment confirmations
- **Recurring billing**: Support for monthly and one-time subscriptions
- **Secure token storage**: Hashed authorization codes in database
- **User-friendly prompts**: Interactive WhatsApp buttons for plan selection
- **Automatic activation**: Immediate subscription activation after successful payment

## Architecture

### Payment Flow

```
1. User sends "subscribe" → Bot shows plans
2. User selects plan → Paystack link generated
3. User clicks link → Paystack payment page
4. User completes payment → Paystack webhook sent
5. Bot verifies signature → Updates database
6. User receives confirmation → Premium features unlocked
```

### Database Schema

New subscription columns added to `users` table:
- `subscription_status` (active/inactive/expired/cancelled)
- `subscription_code` - Paystack subscription code
- `authorization_code` - Hashed authorization token
- `paystack_reference` - Latest transaction reference
- `expiry_date` - Subscription expiry timestamp
- `subscription_plan` - Selected plan (1_month/3_months/lifetime)
- `subscription_metadata` - JSONB for additional Paystack data

## Setup Instructions

### 1. Paystack Account Setup

1. **Create Paystack Account**
   - Visit https://paystack.com
   - Sign up and complete verification
   - Enable test/live keys in settings

2. **Get API Keys**
   - Go to Settings → API Keys & Webhooks
   - Copy **Test Public Key** (pk_test_...)
   - Copy **Test Secret Key** (sk_test_...)
   - Note: Use test keys for development

3. **Configure Webhook**
   - Go to Settings → API Keys & Webhooks
   - Webhook URL: `https://your-domain/paystack-webhook` (or `http://localhost:3000/paystack-webhook` with ngrok)
   - Enable events:
     - `charge.success`
     - `subscription.create`
     - `charge.failed`
     - `subscription.not_renew`
     - `invoice.payment_failed`
     - `subscription.disable`

### 2. Environment Variables

Update your `.env` file with Paystack credentials:

```bash
# Paystack Configuration
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
```

### 3. Database Migration

Run the updated schema to add subscription columns:

```bash
psql -U jamb_user -d jamb_bot -f db/init.sql
```

Or manually alter the users table:

```sql
ALTER TABLE users ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'inactive';
ALTER TABLE users ADD COLUMN subscription_code VARCHAR(255);
ALTER TABLE users ADD COLUMN authorization_code VARCHAR(255);
ALTER TABLE users ADD COLUMN paystack_reference VARCHAR(255);
ALTER TABLE users ADD COLUMN expiry_date TIMESTAMP;
ALTER TABLE users ADD COLUMN subscription_plan VARCHAR(50);
ALTER TABLE users ADD COLUMN subscription_metadata JSONB DEFAULT '{}';
```

### 4. Install Dependencies

```bash
npm install paystack bcryptjs
```

## Testing with Paystack Test Keys

### Using Paystack Test Cards

Paystack provides test cards for development:

| Card Number | Expiration | CVV | Result |
|-------------|-----------|-----|--------|
| 4111 1111 1111 1111 | Any future date | Any 3-digit | Success |
| 4242 4242 4242 4242 | Any future date | Any 3-digit | Success |
| 5555 5555 5555 4444 | Any future date | Any 3-digit | Success |

### Local Testing with ngrok

To test webhooks locally:

1. **Install ngrok** (if not installed)
   ```bash
   curl https://ngrok-agent.s3.amazonaws.com/ngrok-v3-stable-linux-x64.zip -o ngrok.zip
   unzip ngrok.zip
   chmod +x ngrok
   ```

2. **Start your bot locally**
   ```bash
   PORT=3000 npm start
   ```

3. **Start ngrok in another terminal**
   ```bash
   ./ngrok http 3000
   ```

4. **Copy ngrok URL**
   - Note the URL: `https://xxxxx.ngrok.io`
   - Update `.env`: `NGROK_URL=https://xxxxx.ngrok.io`

5. **Configure Paystack Webhook**
   - Go to Paystack Dashboard → Settings → Webhooks
   - Add webhook: `https://xxxxx.ngrok.io/paystack-webhook`

6. **Test the Flow**
   - Send message to bot: "subscribe"
   - Select plan: "1_month", "3_months", or "lifetime"
   - Click payment link
   - Use test card: 4111 1111 1111 1111
   - Complete payment
   - Check database for activated subscription
   - Verify WhatsApp confirmation message

### Testing Without Webhook (Manual Verification)

If webhook doesn't trigger:

1. Note the Paystack reference
   ```javascript
   const ref = "transRef_xxxxx";
   ```

2. Verify payment manually
   ```bash
   curl -X GET "https://api.paystack.co/transaction/verify/{reference}" \
     -H "Authorization: Bearer sk_test_xxxxx"
   ```

3. Manually update database
   ```sql
   UPDATE users SET 
     subscription_status = 'active',
     subscription_plan = '1_month',
     expiry_date = CURRENT_TIMESTAMP + INTERVAL '1 month'
   WHERE phone_number = '234xxxxxxxxxx';
   ```

## API Reference

### Paystack Module (`modules/paystack.js`)

#### Initialize Payment
```javascript
const result = await paystack.initializeSubscription(
  email,
  plan,     // '1_month', '3_months', 'lifetime'
  metadata  // { phone_number, ... }
);
// Returns: { authorization_url, access_code, reference, amount }
```

#### Generate Premium Link
```javascript
const link = await paystack.generatePremiumLink(
  phoneNumber,
  email,
  plan
);
// Returns: { status, authorization_url, access_code, reference, amount, plan }
```

#### Verify Webhook
```javascript
const isValid = paystack.verifyWebhookSignature(
  body,      // req.body
  signature  // req.headers['x-paystack-signature']
);
```

#### Disable Subscription
```javascript
await paystack.disableSubscription(subscriptionCode);
```

#### Hash Authorization Code
```javascript
const hashed = await paystack.hashAuthorizationCode(code);
```

#### Compare Authorization Code
```javascript
const isValid = await paystack.compareAuthorizationCode(code, hash);
```

#### Get Plan Details
```javascript
const details = paystack.getPlanDetails('1_month');
// Returns: { name, amount, displayAmount, interval, description }
```

## Database Module Methods (`modules/database.js`)

### Check Subscription Status
```javascript
const hasSubscription = await db.hasActiveSubscription(phoneNumber);
```

### Get Subscription Details
```javascript
const sub = await db.getUserSubscription(phoneNumber);
// Returns: { subscription_status, subscription_code, subscription_plan, expiry_date, ... }
```

### Update Subscription (on payment success)
```javascript
await db.updateSubscription(
  phoneNumber,
  email,
  subscriptionCode,
  authorizationCode,  // hashed
  plan,
  metadata
);
```

### Deactivate Subscription (on cancellation/failure)
```javascript
await db.deactivateSubscription(phoneNumber, reason);
```

### Store Paystack Reference
```javascript
await db.storePaystackReference(phoneNumber, reference, plan);
```

## Webhook Events

The bot handles these Paystack webhook events:

### charge.success
- Triggered: When one-time payment succeeded
- Action: Activate subscription, send confirmation

### subscription.create
- Triggered: When recurring subscription started
- Action: Activate subscription, store codes, send confirmation

### charge.failed
- Triggered: When payment failed
- Action: Send failure notification to user

### subscription.not_renew
- Triggered: When recurring subscription failed to renew
- Action: Deactivate subscription, notify user

### invoice.payment_failed
- Triggered: When recurring invoice payment failed
- Action: Send notification, deactivate if persistent

### subscription.disable
- Triggered: When subscription manually disabled
- Action: Update database status

## WhatsApp Message Flows

### Subscribe Flow
```
User: "subscribe"
Bot: Shows plan options with prices

User: "1_month" or selects button
Bot: Generates Paystack link
Bot: Sends interactive message with payment URL

User: Clicks link → Completes payment on Paystack
Bot: Receives webhook → Updates DB → Sends confirmation

User: "status"
Bot: Shows active subscription details
```

### Mock Exam / Novel Tutor Flow
```
User: "mock" or "novel"
Bot: Checks subscription status

If inactive:
  Bot: "This is premium feature"
  Bot: Shows subscribe button
  User: "subscribe" → Goes to Subscribe Flow

If active:
  Bot: Starts feature access
```

### Cancel Flow
```
User: "cancel"
Bot: Checks active subscription
Bot: Disables on Paystack
Bot: Updates database
Bot: Sends cancellation confirmation
```

## Error Handling

### Common Errors & Solutions

**Error: "Paystack secret key not configured"**
- Solution: Add `PAYSTACK_SECRET_KEY` to `.env`
- Test: `echo $PAYSTACK_SECRET_KEY`

**Error: "Invalid webhook signature"**
- Possible causes:
  - Wrong secret key
  - Webhook body modified
  - Request headers altered
- Solution: Verify signature key matches Paystack dashboard

**Error: "User not found for phone"**
- Cause: User didn't exist before webhook received
- Solution: Ensure user is created before payment link sent

**Webhook not received**
- Check: Paystack dashboard → Logs → Webhooks
- Check: ngrok logs for incoming requests
- Check: Firewall allowing Paystack IPs
- Solution: Whitelist Paystack IPs if behind firewall

## Security Considerations

### 1. Webhook Verification
- All webhooks verified using HMAC-SHA512
- Signature checked against `x-paystack-signature` header
- Invalid signatures rejected immediately

### 2. Authorization Code Storage
- Stored as bcrypt hashes (never in plaintext)
- Can be compared but never retrieved

### 3. Sensitive Data
- Never log Paystack secret keys
- Never expose authorization codes in messages
- Store payment references for audit trail

### 4. Rate Limiting
- Implement rate limiting on webhook endpoint
- Prevent webhook replay attacks

### 5. SSL/TLS
- Always use HTTPS for webhooks in production
- Use strong TLS certificates

## Production Deployment

### 1. Switch to Live Keys
```bash
# In .env
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
```

### 2. Update Webhook URL
```
https://yourdomain.com/paystack-webhook
```

### 3. Set NODE_ENV
```bash
NODE_ENV=production
```

### 4. Enable SSL
```bash
# Use nginx or similar to handle SSL termination
```

### 5. Database Backup
```bash
pg_dump jamb_bot > backup.sql
```

### 6. Monitor
- Set up logging for webhook events
- Monitor payment failures
- Track subscription activations
- Alert on errors

## Cost Optimization

### Service Messages
- Use WhatsApp service messages for transactional confirmations
- Free tier: up to 1000 service messages/month
- Reduces API call costs

### Database Optimization
- Index `phone_number` and `subscription_status`
- Archive old subscription records quarterly
- Use connection pooling (already configured)

```sql
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_subscription ON users(subscription_status);
```

## Monitoring & Analytics

### Key Metrics
```sql
-- Monthly subscriptions revenue
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as new_subscribers,
  SUM(total_amount) as revenue
FROM subscriptions
GROUP BY DATE_TRUNC('month', created_at);

-- Subscription status breakdown
SELECT subscription_status, COUNT(*) FROM users GROUP BY subscription_status;

-- Expiring subscriptions (next 7 days)
SELECT phone_number, expiry_date FROM users 
WHERE subscription_status = 'active'
AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '7 days';
```

## Troubleshooting Checklist

- [ ] `PAYSTACK_SECRET_KEY` configured in `.env`
- [ ] Paystack webhook URL set in dashboard
- [ ] Webhook IP whitelisted (if applicable)
- [ ] Database migrated with subscription columns
- [ ] Redis running and accessible
- [ ] PostgreSQL running and accessible
- [ ] Ngrok running (for local testing)
- [ ] Test card used correctly
- [ ] Webhook signature verified
- [ ] Bot sending WhatsApp messages
- [ ] Database updates visible after payment
- [ ] Subscription expiry calculated correctly

## Support & Resources

- **Paystack Docs**: https://paystack.com/docs
- **Paystack API Reference**: https://paystack.com/docs/api/
- **WhatsApp Business API**: https://www.whatsapp.com/business/api
- **Bot Support**: Check logs with `tail -f logs/paystack.log`

## Changelog

### v1.0.0 (Current)
- ✅ Paystack integration
- ✅ Phone-based authentication
- ✅ Subscription tiers (1-month, 3-months, lifetime)
- ✅ Webhook verification (HMAC-SHA512)
- ✅ Interactive WhatsApp buttons
- ✅ Secure token hashing (bcrypt)
- ✅ Recurring billing support
- ✅ Database tracking
- ✅ Error handling & logging
- ✅ Test environment support

### Future Enhancements
- [ ] Email notifications on expiry
- [ ] Automatic renewal reminders
- [ ] Multiple payment methods
- [ ] Referral bonuses
- [ ] Subscription analytics dashboard
- [ ] Support for promo codes
- [ ] Payment retry logic

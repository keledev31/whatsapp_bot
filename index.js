const express = require('express');
const axios = require('axios');
require('dotenv').config();

const questions = require('./data/questions.json');
const db = require('./modules/database');
const paystack = require('./modules/paystack');
const redisSession = require('./modules/redis-session');
const whatsappSender = require('./modules/whatsapp-sender');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'change_me';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v17.0';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

// ==================== WhatsApp Webhook Verification ====================

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✓ WhatsApp WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      console.warn('✗ Invalid verification token');
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// ==================== WhatsApp Message Webhook ====================

app.post('/webhook', async (req, res) => {
  try {
    res.sendStatus(200); // Acknowledge receipt immediately

    const body = req.body;
    if (!body || !body.entry) {
      console.warn('Invalid webhook payload');
      return;
    }

    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const messages = value.messages || [];
        
        for (const message of messages) {
          const from = message.from;
          const messageId = message.id;
          
          try {
            // Handle different message types
            if (message.type === 'text') {
              await handleTextMessage(from, message.text.body.trim(), messageId);
            } else if (message.type === 'interactive') {
              await handleInteractiveMessage(from, message.interactive, messageId);
            } else if (message.type === 'button') {
              await handleButtonMessage(from, message.button, messageId);
            }
          } catch (err) {
            console.error(`Error handling message from ${from}:`, err);
            await whatsappSender.sendText(from, 'Sorry, an error occurred while processing your request. Please try again.');
          }
        }
      }
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
  }
});

// ==================== Text Message Handler ====================

async function handleTextMessage(from, text, messageId) {
  if (!text) return;

  // Get or create user
  let user = await db.getUserByPhone(from);
  if (!user) {
    user = await db.getOrCreateUser(from);
  }

  // Handle cancel subscription
  if (text.toLowerCase() === 'cancel') {
    await handleCancelSubscription(from, user);
    return;
  }

  // Handle subscription request
  if (text.toLowerCase().includes('subscribe') || text.toLowerCase().includes('premium')) {
    await handleSubscriptionRequest(from, user);
    return;
  }

  // Handle check status
  if (text.toLowerCase().includes('status')) {
    await handleStatusRequest(from, user);
    return;
  }

  // Handle question queries (existing functionality)
  const match = text.match(/([a-zA-Z]+)\s+(\d{4})\s+q(\d+)/i);
  if (match) {
    const subject = match[1].toLowerCase();
    const year = match[2];
    const qnum = String(parseInt(match[3], 10));

    const found = (questions[subject] && questions[subject][year] && questions[subject][year][qnum]) || null;
    if (found) {
      const reply = `Q${qnum} (${subject} ${year}): ${found.question}\n\nAnswer: ${found.answer}`;
      await whatsappSender.sendText(from, reply);
    } else {
      await whatsappSender.sendText(from, `Sorry, I couldn't find ${subject} ${year} q${qnum} in the database.`);
    }
    return;
  }

  // Handle mock exam request
  if (text.toLowerCase().includes('mock')) {
    await handleMockExamRequest(from, user);
    return;
  }

  // Handle novel tutor request
  if (text.toLowerCase().includes('novel') || text.toLowerCase().includes('tutor')) {
    await handleNovelTutorRequest(from, user);
    return;
  }

  // Default message
  const helpMessage = `Welcome to JAMB CBT Bot! 📚\n\nWhat would you like to do?\n1. Query Questions: Send 'english 2023 q15'\n2. Practice: Send 'practice [subject]'\n3. Full Mock Exam: Send 'mock' (premium)\n4. Novel Tutor: Send 'novel' (premium)\n5. Subscribe: Send 'subscribe'\n6. Check Status: Send 'status'\n7. Cancel: Send 'cancel'`;
  await whatsappSender.sendText(from, helpMessage);
}

// ==================== Interactive Message Handler ====================

async function handleInteractiveMessage(from, interactive, messageId) {
  const user = await db.getUserByPhone(from);
  if (!user) {
    await whatsappSender.sendText(from, 'Please restart your session. Send any message to continue.');
    return;
  }

  if (interactive.type === 'button_reply') {
    const buttonId = interactive.button_reply.id;
    const buttonTitle = interactive.button_reply.title;

    // Handle premium plan selection
    if (buttonId.startsWith('premium_')) {
      const plan = buttonId.replace('premium_', '').replace('-', '_');
      await handlePremiumPlanSelection(from, user, plan);
    }
  } else if (interactive.type === 'list_reply') {
    const selectedId = interactive.list_reply.id;
    const selectedTitle = interactive.list_reply.title;
    // Handle list selections as needed
    console.log(`List selection: ${selectedId} - ${selectedTitle}`);
  }
}

// ==================== Button Message Handler ====================

async function handleButtonMessage(from, buttonData, messageId) {
  const user = await db.getUserByPhone(from);
  if (!user) {
    await whatsappSender.sendText(from, 'Please restart your session. Send any message to continue.');
    return;
  }

  await whatsappSender.sendText(from, 'Processing your request...');
}

// ==================== Subscription Handlers ====================

async function handleSubscriptionRequest(from, user) {
  try {
    // Check if already subscribed
    const hasSubscription = await db.hasActiveSubscription(from);
    if (hasSubscription) {
      await whatsappSender.sendText(from, '✓ You already have an active subscription! Enjoy your premium features.');
      return;
    }

    // Show subscription plans with interactive buttons
    const planMessage = '🎯 Choose Your Premium Plan:\n\n₦500/month - Monthly Access\n₦1,300 - 3 Months Access\n₦5,000 - Lifetime Access';
    
    // Send interactive message with buttons (using the WhatsApp sender module if available)
    await whatsappSender.sendText(from, planMessage);
    await whatsappSender.sendText(from, 'Please reply with: 1_month, 3_months, or lifetime');

  } catch (err) {
    console.error('Error handling subscription request:', err);
    await whatsappSender.sendText(from, 'Error processing subscription request. Please try again.');
  }
}

async function handlePremiumPlanSelection(from, user, plan) {
  try {
    console.log(`Processing premium plan selection: ${plan} for user ${from}`);

    // Validate plan
    const validPlans = ['1_month', '3_months', 'lifetime'];
    if (!validPlans.includes(plan)) {
      await whatsappSender.sendText(from, 'Invalid plan selected. Please choose: 1_month, 3_months, or lifetime');
      return;
    }

    // Get or update user email if not present
    let email = user.email;
    if (!email) {
      // For now, generate a placeholder email based on phone
      email = `user_${from}@jambbot.local`;
      await db.getOrCreateUser(from, user.full_name);
    }

    // Generate Paystack payment link
    const paymentResult = await paystack.generatePremiumLink(from, email, plan);
    if (paymentResult.status !== 'success') {
      console.error('Paystack payment generation failed:', paymentResult);
      await whatsappSender.sendText(from, 'Failed to generate payment link. Please try again or contact support.');
      return;
    }

    // Store the reference temporarily in Redis
    await redisSession.setSession(from, {
      mode: 'payment_pending',
      plan: plan,
      reference: paymentResult.reference,
      access_code: paymentResult.access_code,
      created_at: new Date().toISOString()
    });

    // Also store reference in database
    await db.storePaystackReference(from, paymentResult.reference, plan);

    // Send payment link
    const planDetails = paystack.getPlanDetails(plan);
    const paymentMessage = `💳 Complete Your Subscription\n\n📱 Plan: ${planDetails.name}\n💰 Amount: ${planDetails.displayAmount}\n\n🔗 Click the link below to pay:\n${paymentResult.authorization_url}\n\nAfter payment, your subscription will be activated automatically.`;
    
    await whatsappSender.sendText(from, paymentMessage);

  } catch (err) {
    console.error('Error processing plan selection:', err);
    await whatsappSender.sendText(from, 'Error processing your selection. Please try again.');
  }
}

async function handleMockExamRequest(from, user) {
  try {
    // Check subscription
    const hasSubscription = await db.hasActiveSubscription(from);
    if (!hasSubscription) {
      const subscriptionPrompt = '📝 Full Mock Exams are a premium feature!\n\nWould you like to subscribe now?';
      await whatsappSender.sendText(from, subscriptionPrompt);
      await sendSubscribeButton(from, user);
      return;
    }

    // User has subscription - proceed with mock exam
    await whatsappSender.sendText(from, '⏱️ Starting full mock exam (180 questions, 120 minutes)...\nThis is a demo. In production, this would start the timed exam.');

  } catch (err) {
    console.error('Error handling mock exam request:', err);
    await whatsappSender.sendText(from, 'Error starting mock exam. Please try again.');
  }
}

async function handleNovelTutorRequest(from, user) {
  try {
    // Check subscription
    const hasSubscription = await db.hasActiveSubscription(from);
    if (!hasSubscription) {
      const subscriptionPrompt = '📖 Novel Tutor is a premium feature!\n\nWould you like to subscribe now?';
      await whatsappSender.sendText(from, subscriptionPrompt);
      await sendSubscribeButton(from, user);
      return;
    }

    // User has subscription - provide novel tutor content
    await whatsappSender.sendText(from, '📖 Novel Tutor Feature\nStarting "The Lekki Headmaster" tutorial...\nThis is a demo. In production, this would provide interactive novel learning.');

  } catch (err) {
    console.error('Error handling novel tutor request:', err);
    await whatsappSender.sendText(from, 'Error accessing novel tutor. Please try again.');
  }
}

async function handleStatusRequest(from, user) {
  try {
    const subscription = await db.getUserSubscription(from);
    
    if (!subscription || subscription.subscription_status !== 'active') {
      await whatsappSender.sendText(from, '❌ No active subscription.\n\nSend "subscribe" to get premium access.');
      return;
    }

    const expiryDate = new Date(subscription.expiry_date);
    const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
    
    const statusMessage = `✅ Your Subscription Status:\n\n📅 Plan: ${subscription.subscription_plan}\n📆 Expires: ${expiryDate.toLocaleDateString()}\n⏰ Days Left: ${daysLeft > 0 ? daysLeft : 'Expired'}`;
    await whatsappSender.sendText(from, statusMessage);

  } catch (err) {
    console.error('Error handling status request:', err);
    await whatsappSender.sendText(from, 'Error retrieving status. Please try again.');
  }
}

async function handleCancelSubscription(from, user) {
  try {
    const subscription = await db.getUserSubscription(from);
    
    if (!subscription || subscription.subscription_status !== 'active') {
      await whatsappSender.sendText(from, 'You do not have an active subscription to cancel.');
      return;
    }

    // Try to disable on Paystack if subscription code exists
    if (subscription.subscription_code) {
      try {
        await paystack.disableSubscription(subscription.subscription_code);
      } catch (err) {
        console.warn('Could not disable on Paystack:', err.message);
      }
    }

    // Deactivate in database
    await db.deactivateSubscription(from, 'User cancelled');
    await whatsappSender.sendText(from, '❌ Your subscription has been cancelled.\n\nWe hope to see you again soon!');

  } catch (err) {
    console.error('Error handling subscription cancellation:', err);
    await whatsappSender.sendText(from, 'Error cancelling subscription. Please try again.');
  }
}

async function sendSubscribeButton(from, user) {
  const message = '💳 Choose a plan:\n\n₦500 - Monthly\n₦1,300 - 3 Months\n₦5,000 - Lifetime\n\nReply with: 1_month, 3_months, or lifetime';
  await whatsappSender.sendText(from, message);
}

// ==================== Paystack Webhook Handler ====================

app.post('/paystack-webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const body = req.body;

    // Verify signature
    const isValid = paystack.verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.warn('Invalid Paystack webhook signature');
      return res.status(401).json({ status: 'error', message: 'Invalid signature' });
    }

    const event = req.body.event;
    const payloadData = req.body.data;

    console.log(`Processing Paystack webhook: ${event}`);

    // Handle webhook events
    const result = await paystack.handleWebhook(event, payloadData);
    
    if (result.status === 'success') {
      // Get phone number from metadata
      const phoneNumber = result.customer_phone;
      
      if (!phoneNumber) {
        console.warn('No phone number in webhook payload');
        return res.json({ status: 'ok' });
      }

      // Update user subscription
      const user = await db.getUserByPhone(phoneNumber);
      if (!user) {
        console.warn(`User not found for phone: ${phoneNumber}`);
        return res.json({ status: 'ok' });
      }

      try {
        // Hash authorization code if present
        let hashedAuthCode = null;
        if (result.authorization_code) {
          hashedAuthCode = await paystack.hashAuthorizationCode(result.authorization_code);
        }

        // Update subscription in database
        await db.updateSubscription(
          phoneNumber,
          result.customer_email,
          result.subscription_code,
          hashedAuthCode,
          result.plan,
          {
            paystack_reference: result.reference,
            webhook_timestamp: new Date().toISOString(),
            event_type: result.type
          }
        );

        // Send confirmation message via WhatsApp
        const planDetails = paystack.getPlanDetails(result.plan);
        const confirmationMessage = `✅ Subscription Activated!\n\n🎉 Welcome to Premium Access\n📱 Plan: ${planDetails.name}\n💰 Amount: ${planDetails.displayAmount}\n\n📖 You can now access:\n✓ Full Mock Exams\n✓ Novel Tutors\n✓ Unlimited Practice\n\nEnjoy your learning journey!`;
        
        await whatsappSender.sendText(phoneNumber, confirmationMessage);

        // Clear pending session
        await redisSession.endSession(phoneNumber);

      } catch (err) {
        console.error('Error updating subscription after payment:', err);
        await whatsappSender.sendText(phoneNumber, 'Payment received, but there was an error activating your subscription. Please contact support.');
      }

    } else if (result.status === 'failed' || result.status === 'invoice_failed') {
      const phoneNumber = result.customer_phone;
      
      if (phoneNumber) {
        const failureMessage = `❌ Payment Failed\n\nReason: ${result.reason}\n\nPlease try again or contact support if the issue persists.`;
        await whatsappSender.sendText(phoneNumber, failureMessage);
      }

    } else if (result.status === 'cancelled') {
      const phoneNumber = result.customer_phone || result.customer_email;
      
      if (phoneNumber) {
        await whatsappSender.sendText(phoneNumber, 'Your subscription has been cancelled as requested.');
      }
    }

    res.json({ status: 'ok' });

  } catch (err) {
    console.error('Error processing Paystack webhook:', err);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// ==================== Health Check ====================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== Server Startup ====================

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database
    await db.initialize();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(50)}`);
      console.log('🤖 WhatsApp Bot Server Started');
      console.log(`📍 Listening on port ${PORT}`);
      console.log(`✓ Database initialized`);
      console.log(`✓ Paystack integration enabled`);
      console.log(`✓ Redis session management active`);
      console.log(`${'='.repeat(50)}\n`);
      console.log('Endpoints:');
      console.log(`  GET  /health              - Health check`);
      console.log(`  GET  /webhook             - WhatsApp webhook verification`);
      console.log(`  POST /webhook             - WhatsApp message handler`);
      console.log(`  POST /paystack-webhook    - Paystack payment webhook`);
      console.log(`${'='.repeat(50)}\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await db.close();
  process.exit(0);
});

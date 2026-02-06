const axios = require('axios');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const PAYSTACK_API_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

const paystack = {
  /**
   * Initialize payment (create authorization link)
   */
  async initializePayment(email, amount, metadata) {
    if (!PAYSTACK_SECRET) {
      console.warn('Paystack secret key not configured');
      return { status: false, message: 'Payment not configured' };
    }

    try {
      const response = await axios.post(
        `${PAYSTACK_API_URL}/transaction/initialize`,
        {
          email,
          amount: Math.round(amount * 100), // Paystack expects amount in kobo (multiply by 100)
          metadata
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to initialize payment');
      }

      return response.data.data;
    } catch (error) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Verify payment
   */
  async verifyPayment(reference) {
    if (!PAYSTACK_SECRET) {
      console.warn('Paystack secret key not configured');
      return { status: false, message: 'Payment not configured' };
    }

    try {
      const response = await axios.get(
        `${PAYSTACK_API_URL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`
          }
        }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to verify payment');
      }

      return response.data.data;
    } catch (error) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Initialize subscription (recurring)
   */
  async initializeSubscription(email, plan = '1_month', metadata = {}) {
    if (!PAYSTACK_SECRET) {
      console.warn('Paystack secret key not configured');
      return { status: false, message: 'Payment not configured' };
    }

    const plans = {
      '1_month': { amount: 50000, interval: 'monthly', description: '₦500/month - Monthly Premium' },
      '3_months': { amount: 130000, interval: 'monthly', description: '₦1,300 - 3 Months Premium' },
      'lifetime': { amount: 500000, interval: 'once', description: '₦5,000 - Lifetime Access' }
    };

    const planDetails = plans[plan] || plans['1_month'];

    try {
      const payload = {
        email,
        amount: planDetails.amount, // Amount in kobo
        metadata: {
          ...metadata,
          plan,
          description: planDetails.description
        }
      };

      // For monthly subscriptions, we'll handle it as a regular transaction
      // User can set up recurring via their Paystack dashboard or through Authorization
      const response = await axios.post(
        `${PAYSTACK_API_URL}/transaction/initialize`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to initialize subscription');
      }

      return response.data.data;
    } catch (error) {
      console.error('Paystack subscription initialization error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Disable subscription
   */
  async disableSubscription(subscriptionCode) {
    if (!PAYSTACK_SECRET) {
      console.warn('Paystack secret key not configured');
      return { status: false, message: 'Payment not configured' };
    }

    try {
      const response = await axios.post(
        `${PAYSTACK_API_URL}/subscription/disable`,
        { code: subscriptionCode },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to disable subscription');
      }

      return response.data.data;
    } catch (error) {
      console.error('Paystack subscription disable error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Generate payment link for premium access (single or recurring)
   */
  async generatePremiumLink(phoneNumber, email, plan = '1_month') {
    const plans = {
      '1_month': { amount: 500, description: '₦500/month - Monthly Premium Access', type: 'recurring' },
      '3_months': { amount: 1300, description: '₦1,300 - 3 Months Premium Access', type: 'recurring' },
      'lifetime': { amount: 5000, description: '₦5,000 - Lifetime Premium Access', type: 'once' }
    };

    const planDetails = plans[plan] || plans['1_month'];

    try {
      const paymentData = await this.initializeSubscription(email, plan, {
        phone_number: phoneNumber,
        timestamp: new Date().toISOString()
      });

      return {
        status: 'success',
        authorization_url: paymentData.authorization_url,
        access_code: paymentData.access_code,
        reference: paymentData.reference,
        amount: paymentData.amount / 100, // Convert kobo to naira
        plan: plan,
        description: planDetails.description
      };
    } catch (error) {
      console.error('Error generating premium link:', error);
      return {
        status: 'error',
        message: 'Failed to generate payment link',
        error: error.message
      };
    }
  },

  /**
   * Verify webhook signature using HMAC-SHA512
   */
  verifyWebhookSignature(body, signature) {
    if (!PAYSTACK_SECRET) {
      console.warn('Paystack secret key not configured for signature verification');
      return false;
    }

    try {
      const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex');

      const isValid = hash === signature;
      if (!isValid) {
        console.warn('Invalid webhook signature received');
      }
      return isValid;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  },

  /**
   * Create payment button (for WhatsApp interactive messages)
   */
  createPaymentButton(phoneNumber, email, plan = '1_month') {
    const plans = {
      '1_month': '₦500 - Monthly',
      '3_months': '₦1,300 - 3 Months',
      'lifetime': '₦5,000 - Lifetime'
    };

    return {
      type: 'button',
      id: `premium_${plan.replace('_', '-')}`,
      title: `Premium ${plans[plan]}`
    };
  },

  /**
   * Handle Paystack webhook events
   */
  async handleWebhook(event, payloadData) {
    try {
      const data = payloadData.data || payloadData;

      switch (event) {
        case 'charge.success':
        case 'subscription.create':
          return {
            status: 'success',
            type: event,
            reference: data.reference,
            customer_email: data.customer?.email,
            customer_phone: data.metadata?.phone_number,
            amount: (data.amount || 0) / 100, // Convert kobo to naira
            subscription_code: data.subscription_code,
            plan: data.metadata?.plan,
            authorization_code: data.authorization?.authorization_code,
            authentication_type: data.authorization?.authentication_type
          };

        case 'charge.failed':
        case 'subscription.not_renew':
          return {
            status: 'failed',
            type: event,
            reference: data.reference,
            customer_email: data.customer?.email,
            customer_phone: data.metadata?.phone_number,
            reason: data.gateway_response || 'Payment/Subscription failed'
          };

        case 'invoice.payment_failed':
          return {
            status: 'invoice_failed',
            type: event,
            subscription_code: data.subscription?.subscription_code,
            customer_email: data.customer?.email,
            reason: data.gateway_response
          };

        case 'subscription.disable':
          return {
            status: 'cancelled',
            type: event,
            subscription_code: data.subscription_code,
            customer_email: data.customer?.email
          };

        default:
          console.log('Unhandled webhook event:', event);
          return { status: 'unknown', event };
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  },

  /**
   * Hash authorization code for secure storage
   */
  async hashAuthorizationCode(code) {
    try {
      const hash = await bcrypt.hash(code, 10);
      return hash;
    } catch (error) {
      console.error('Error hashing authorization code:', error);
      throw error;
    }
  },

  /**
   * Compare authorization code with hash
   */
  async compareAuthorizationCode(code, hash) {
    try {
      return await bcrypt.compare(code, hash);
    } catch (error) {
      console.error('Error comparing authorization code:', error);
      return false;
    }
  },

  /**
   * Calculate subscription expiry date
   */
  calculateExpiryDate(plan) {
    const now = new Date();
    let expiryDate = new Date(now);

    switch (plan) {
      case '1_month':
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        break;
      case '3_months':
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        break;
      case 'lifetime':
        expiryDate.setFullYear(expiryDate.getFullYear() + 100); // 100 years effectively lifetime
        break;
      default:
        expiryDate.setMonth(expiryDate.getMonth() + 1);
    }

    return expiryDate;
  },

  /**
   * Plan details for reference
   */
  getPlanDetails(plan) {
    const plans = {
      '1_month': {
        name: 'Monthly Premium',
        amount: 500,
        displayAmount: '₦500',
        interval: 'monthly',
        description: 'Access to full mock exams, novel tutors, and practice sets'
      },
      '3_months': {
        name: '3-Month Premium',
        amount: 1300,
        displayAmount: '₦1,300',
        interval: 'quarterly',
        description: 'Access to full mock exams, novel tutors, and practice sets'
      },
      'lifetime': {
        name: 'Lifetime Premium',
        amount: 5000,
        displayAmount: '₦5,000',
        interval: 'once',
        description: 'Permanent access to all premium features'
      }
    };

    return plans[plan] || plans['1_month'];
  }
};

module.exports = paystack;

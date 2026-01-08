
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const updateProfile = async (userId: string, planId: string, customerId: string) => {
  console.log(`Webhook: Updating DB for User ${userId}, Plan ${planId}`);
  
  const limits: Record<string, number> = {
    'basic': 30,
    'pro': 100,
    'business': 500
  };

  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      plan_id: planId,
      is_trial_active: false,
      subscription_expiry: Date.now() + (31 * 24 * 60 * 60 * 1000), // 31 days
      stripe_customer_id: customerId,
      monthly_docs_limit: limits[planId] || 100,
      docs_used_this_month: 0 
    })
    .eq('id', userId)
    .select();

  if (error) {
    console.error("Webhook Supabase Error:", error);
    return false;
  }
  
  if (!data || data.length === 0) {
    console.error(`Webhook: No profile found for UUID ${userId}. This is likely a metadata mismatch.`);
    return false;
  }

  console.log(`Webhook: Success! Updated user ${userId}`);
  return true;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body || '', sig || '', webhookSecret || '');
  } catch (err: any) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log(`Webhook: Received event type ${stripeEvent.type}`);

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId || 'pro';
      const customerId = session.customer as string;

      if (userId) {
        await updateProfile(userId, planId, customerId);
      } else {
        console.error("Webhook: checkout.session.completed missing userId in metadata");
      }
    } 
    
    // Backup: Handle subscription creation directly
    if (stripeEvent.type === 'customer.subscription.created') {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      
      // Look up session to find metadata if it's missing on the subscription
      const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 1 });
      if (sessions.data.length > 0) {
        const session = sessions.data[0];
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId || 'pro';
        if (userId) {
          await updateProfile(userId, planId, customerId);
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err: any) {
    console.error(`Webhook Runtime Error: ${err.message}`);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

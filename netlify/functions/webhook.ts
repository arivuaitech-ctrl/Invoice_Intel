
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// IMPORTANT: Using Service Role Key to bypass RLS for server-side updates
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

const updateProfile = async (userId: string | undefined, email: string | undefined, planId: string, customerId: string) => {
  console.log(`[Webhook] Attempting update. ID: ${userId}, Email: ${email}, Plan: ${planId}`);
  
  const limits: Record<string, number> = {
    'basic': 30,
    'pro': 100,
    'business': 500
  };

  const payload = { 
    plan_id: planId,
    is_trial_active: false,
    subscription_expiry: Date.now() + (32 * 24 * 60 * 60 * 1000), // 32 days for safety
    stripe_customer_id: customerId,
    monthly_docs_limit: limits[planId] || 100,
    docs_used_this_month: 0 
  };

  // 1. Try by UUID
  if (userId) {
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select();
    if (data && data.length > 0) {
      console.log(`[Webhook] SUCCESS: Updated by UUID ${userId}`);
      return true;
    }
    if (error) console.error(`[Webhook] UUID Update Error:`, error);
  }

  // 2. Try by Email
  if (email) {
    const { data, error } = await supabase.from('profiles').update(payload).eq('email', email).select();
    if (data && data.length > 0) {
      console.log(`[Webhook] SUCCESS: Updated by Email ${email}`);
      return true;
    }
    if (error) console.error(`[Webhook] Email Update Error:`, error);
  }

  console.error(`[Webhook] FAILED: Could not find user to update.`);
  return false;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET is missing in environment.");
    return { statusCode: 500, body: "Server configuration error" };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body || '', sig || '', webhookSecret);
  } catch (err: any) {
    console.error(`[Webhook] Signature Verification Failed: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  console.log(`[Webhook] Event Received: ${stripeEvent.type}`);

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      await updateProfile(
        session.metadata?.userId,
        session.metadata?.userEmail || session.customer_details?.email || undefined,
        session.metadata?.planId || 'pro',
        session.customer as string
      );
    } 

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err: any) {
    console.error(`[Webhook] Runtime Exception:`, err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

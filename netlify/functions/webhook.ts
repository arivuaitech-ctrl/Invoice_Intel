
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

// CRITICAL: Use SUPABASE_SERVICE_ROLE_KEY to bypass RLS for administrative updates
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

const updateProfile = async (userId: string | undefined, email: string | undefined, planId: string, customerId: string) => {
  console.log(`[Webhook] Processing Update. ID: ${userId}, Email: ${email}, Plan: ${planId}`);
  
  const limits: Record<string, number> = {
    'basic': 30,
    'pro': 100,
    'business': 500
  };

  const payload = { 
    plan_id: planId,
    is_trial_active: false,
    subscription_expiry: Date.now() + (32 * 24 * 60 * 60 * 1000),
    stripe_customer_id: customerId,
    monthly_docs_limit: limits[planId] || 100,
    docs_used_this_month: 0 
  };

  // Strategy 1: Update by internal UUID (Standard)
  if (userId) {
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select();
    if (data && data.length > 0) {
      console.log(`[Webhook] Success: Profile ${userId} updated.`);
      return true;
    }
    if (error) console.error(`[Webhook] Supabase Error (UUID):`, error);
  }

  // Strategy 2: Update by Email (Fallback)
  if (email) {
    const { data, error } = await supabase.from('profiles').update(payload).eq('email', email).select();
    if (data && data.length > 0) {
      console.log(`[Webhook] Success: Profile ${email} updated via email fallback.`);
      return true;
    }
    if (error) console.error(`[Webhook] Supabase Error (Email):`, error);
  }

  console.error(`[Webhook] Failure: No matching profile found for ID:${userId} or Email:${email}`);
  return false;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Webhook] Error: STRIPE_WEBHOOK_SECRET is not configured.");
    return { statusCode: 500, body: "Webhook Secret Missing" };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body || '', sig || '', webhookSecret);
  } catch (err: any) {
    console.error(`[Webhook] Verification Failed: ${err.message}`);
    return { statusCode: 400, body: `Verification Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const success = await updateProfile(
        session.metadata?.userId,
        session.metadata?.userEmail || session.customer_details?.email || undefined,
        session.metadata?.planId || 'pro',
        session.customer as string
      );
      
      if (!success) {
        // We return 200 so Stripe doesn't keep retrying, but we log the failure internally.
        console.warn("[Webhook] Payment received but profile update failed.");
      }
    } 

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err: any) {
    console.error(`[Webhook] Fatal Error:`, err);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

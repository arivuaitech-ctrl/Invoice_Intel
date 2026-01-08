
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

const updateProfile = async (identifier: { id?: string, email?: string }, planId: string, customerId: string) => {
  const limits: Record<string, number> = {
    'basic': 30,
    'pro': 100,
    'business': 500
  };

  const updatePayload = { 
    plan_id: planId,
    is_trial_active: false,
    subscription_expiry: Date.now() + (31 * 24 * 60 * 60 * 1000),
    stripe_customer_id: customerId,
    monthly_docs_limit: limits[planId] || 100,
    docs_used_this_month: 0 
  };

  let query = supabase.from('profiles').update(updatePayload);
  
  // Try ID first, then Email
  if (identifier.id) {
    query = query.eq('id', identifier.id);
  } else if (identifier.email) {
    query = query.eq('email', identifier.email);
  } else {
    return false;
  }

  const { data, error } = await query.select();

  if (error) {
    console.error("Webhook Supabase Error:", error);
    return false;
  }
  
  if (!data || data.length === 0) {
    // If ID failed, try email fallback manually
    if (identifier.id && identifier.email) {
        console.log("Webhook: UUID failed, attempting Email fallback for", identifier.email);
        const fallback = await supabase.from('profiles')
            .update(updatePayload)
            .eq('email', identifier.email)
            .select();
        return (fallback.data && fallback.data.length > 0);
    }
    return false;
  }

  return true;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body || '', sig || '', webhookSecret || '');
  } catch (err: any) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      await updateProfile(
        { id: session.metadata?.userId, email: session.metadata?.userEmail || session.customer_details?.email || undefined },
        session.metadata?.planId || 'pro',
        session.customer as string
      );
    } 

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err: any) {
    return { statusCode: 500, body: "Internal Server Error" };
  }
};


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
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId || 'pro';
    const customerId = session.customer as string;
    
    // Map internal plans to document limits
    const limits: Record<string, number> = {
      'basic': 30,
      'pro': 100,
      'business': 500
    };

    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          plan_id: planId,
          is_trial_active: false,
          subscription_expiry: Date.now() + (31 * 24 * 60 * 60 * 1000), // 31 days
          stripe_customer_id: customerId,
          monthly_docs_limit: limits[planId] || 100,
          docs_used_this_month: 0 // Reset usage on new sub
        })
        .eq('id', userId);
        
      if (error) console.error("Webhook Supabase Error:", error);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

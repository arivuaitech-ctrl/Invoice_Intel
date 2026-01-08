
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
    stripeEvent = stripe.webhooks.constructEvent(
      event.body || '',
      sig || '',
      webhookSecret || ''
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const customerId = session.customer as string;
    
    // We need to determine which plan they bought to set the limits
    // For simplicity in this demo, we mark as 'pro'
    // In production, you would look up the priceId from session.line_items
    
    if (userId) {
      console.log(`Setting up subscription for user ${userId} with Stripe Customer ${customerId}`);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          plan_id: 'pro',
          is_trial_active: false,
          subscription_expiry: Date.now() + (30 * 24 * 60 * 60 * 1000),
          stripe_customer_id: customerId,
          monthly_docs_limit: 100 // Default to Pro limit
        })
        .eq('id', userId);
        
      if (error) console.error("Supabase Profile Update Error:", error);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};

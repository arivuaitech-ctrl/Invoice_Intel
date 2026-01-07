import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any, // Use a standard stable version for better build compatibility
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Note: For a real production webhook, you need the raw body.
    // This simplified version assumes the body is already parsed for the demo.
    event = stripe.webhooks.constructEvent(
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      sig,
      webhookSecret || ''
    );
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    
    if (userId) {
      await supabase
        .from('profiles')
        .update({ 
          plan_id: 'pro',
          is_trial_active: false,
          subscription_expiry: Date.now() + (30 * 24 * 60 * 60 * 1000)
        })
        .eq('id', userId);
    }
  }

  res.status(200).json({ received: true });
}
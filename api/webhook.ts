import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // Fixed: Update to the expected Stripe API version string
  apiVersion: '2025-12-15.clover' as any,
});

// We use the Service Role Key here because the webhook needs to bypass Row Level Security (RLS) 
// to update user profiles regardless of their login state.
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: any, res: any) {
  // Stripe webhooks require the raw body for signature verification.
  // In a standard Vercel environment, you might need to disable body parsing for this route.
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret || '');
  } catch (err: any) {
    console.error(`Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    
    if (userId) {
      console.log(`Payment successful for user: ${userId}. Updating subscription...`);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          plan_id: 'pro', // Map this dynamically if you have multiple paid plans
          is_trial_active: false,
          subscription_expiry: Date.now() + (30 * 24 * 60 * 60 * 1000) // +30 days
        })
        .eq('id', userId);

      if (error) {
        console.error("Supabase Update Error:", error);
        return res.status(500).json({ error: "Failed to update user profile" });
      }
    }
  }

  res.status(200).json({ received: true });
}
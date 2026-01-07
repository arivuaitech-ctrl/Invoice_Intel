import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
// Add explicit Buffer import to fix "Cannot find name 'Buffer'"
import { Buffer } from 'buffer';

// Vercel config to disable the default body parser for this route
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Helper function to get the raw body - renamed from 'buffer' to 'readRawBody' to avoid name collision with Buffer class
async function readRawBody(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    // Fixed: Using Buffer from the imported module to avoid shadowing issues
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  // Fixed: Using Buffer from the imported module to avoid shadowing issues
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Fixed: Using the renamed helper function readRawBody
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
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
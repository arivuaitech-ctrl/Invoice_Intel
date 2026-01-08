
import Stripe from 'stripe';
import { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { priceId, userId, userEmail } = body;

    // 1. Map internal IDs (basic, pro, business) to Stripe Price IDs from Netlify Env Vars
    const priceMap: Record<string, string | undefined> = {
      'basic': process.env.STRIPE_PRICE_ID_BASIC,
      'pro': process.env.STRIPE_PRICE_ID_PRO,
      'business': process.env.STRIPE_PRICE_ID_BUSINESS,
    };

    const stripePriceId = priceMap[priceId];

    // DEBUG LOGS (Visible in Netlify Function Logs)
    console.log(`[Checkout] Request for package: ${priceId}`);
    console.log(`[Checkout] Mapped to Stripe ID: ${stripePriceId || 'MISSING'}`);

    // VALIDATION: This prevents sending the string 'basic' to Stripe.
    if (!stripePriceId || !stripePriceId.startsWith('price_')) {
      const errorDetail = `Configuration Error: The environment variable for '${priceId}' is either missing or invalid. It must start with 'price_'. Found: '${stripePriceId || 'undefined'}'. Please check Netlify and RE-DEPLOY.`;
      console.error(errorDetail);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: errorDetail }),
      };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is missing from Netlify environment variables.");
    }

    // 2. Determine redirect URLs safely
    let cleanBaseUrl = 'http://localhost:8888';
    const rawUrl = process.env.SITE_URL || event.headers.origin || event.headers.referer;
    
    if (rawUrl) {
      try {
        cleanBaseUrl = new URL(rawUrl).origin;
      } catch (e) {
        cleanBaseUrl = rawUrl.split(/[?#]/)[0].replace(/\/$/, "");
      }
    }

    // 3. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ 
        price: stripePriceId, 
        quantity: 1 
      }],
      mode: 'subscription',
      success_url: `${cleanBaseUrl}/?session_id={CHECKOUT_SESSION_ID}&payment=success`,
      cancel_url: `${cleanBaseUrl}/?payment=cancelled`,
      customer_email: userEmail,
      metadata: { userId },
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error('[Stripe Error]:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: error.message || "Internal Server Error",
        details: "Check your Netlify function logs for full details."
      }),
    };
  }
};

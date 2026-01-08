
import Stripe from 'stripe';
import { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { priceId, userId, userEmail } = body;

    const priceMap: Record<string, string | undefined> = {
      'basic': process.env.STRIPE_PRICE_ID_BASIC,
      'pro': process.env.STRIPE_PRICE_ID_PRO,
      'business': process.env.STRIPE_PRICE_ID_BUSINESS,
    };

    const stripePriceId = priceMap[priceId];

    if (!stripePriceId || !stripePriceId.startsWith('price_')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Configuration Error: Price ID for '${priceId}' not found in environment variables.` }),
      };
    }

    let cleanBaseUrl = 'http://localhost:8888';
    const rawUrl = process.env.SITE_URL || event.headers.origin || event.headers.referer;
    if (rawUrl) {
      try {
        cleanBaseUrl = new URL(rawUrl).origin;
      } catch (e) {
        cleanBaseUrl = rawUrl.split(/[?#]/)[0].replace(/\/$/, "");
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: stripePriceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${cleanBaseUrl}/?payment=success`,
      cancel_url: `${cleanBaseUrl}/?payment=cancelled`,
      customer_email: userEmail,
      metadata: { 
        userId,
        userEmail, // Backup for webhook lookup
        planId: priceId 
      },
      allow_promotion_codes: true,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

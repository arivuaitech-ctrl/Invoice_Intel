
import Stripe from 'stripe';
import { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any,
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { customerId } = JSON.parse(event.body || '{}');

    if (!customerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No customer ID provided. You must have a paid subscription to access the portal." })
      };
    }

    // Determine return URL
    let returnUrl = 'http://localhost:8888';
    const rawUrl = process.env.SITE_URL || event.headers.origin || event.headers.referer;
    if (rawUrl) {
      try {
        returnUrl = new URL(rawUrl).origin;
      } catch (e) {
        returnUrl = rawUrl.split(/[?#]/)[0].replace(/\/$/, "");
      }
    }

    // Create a Stripe Customer Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error('Customer Portal Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to create portal session" })
    };
  }
};

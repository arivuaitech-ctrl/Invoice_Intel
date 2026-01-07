import { UserProfile } from '../types';
import { PRICING_PACKAGES } from './userService';

export const stripeService = {
  /**
   * Redirects the user to a real Stripe Checkout page hosted on your Vercel API.
   */
  redirectToCheckout: async (user: UserProfile, packageId: string): Promise<void> => {
    const pkg = PRICING_PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new Error("Invalid package");

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId: pkg.id, // In production, this would be your Stripe Price ID (e.g., price_123...)
          userId: user.id,
          userEmail: user.email
        })
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Stripe Redirect Error:", error);
      throw error;
    }
  }
};
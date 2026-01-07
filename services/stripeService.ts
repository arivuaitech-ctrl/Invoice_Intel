import { UserProfile } from '../types';
import { PRICING_PACKAGES } from './userService';

export const stripeService = {
  /**
   * Redirects the user to a real Stripe Checkout page hosted on Netlify Functions.
   */
  redirectToCheckout: async (user: UserProfile, packageId: string): Promise<void> => {
    const pkg = PRICING_PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new Error("Invalid package");

    try {
      // Netlify functions are served under /.netlify/functions/
      const response = await fetch('/.netlify/functions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId: pkg.id,
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
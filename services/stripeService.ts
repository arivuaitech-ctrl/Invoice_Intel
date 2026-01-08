
import { UserProfile } from '../types';
import { PRICING_PACKAGES } from './userService';

export const stripeService = {
  /**
   * Redirects the user to a real Stripe Checkout page hosted on Netlify Functions.
   */
  redirectToCheckout: async (user: UserProfile, packageId: string): Promise<void> => {
    const pkg = PRICING_PACKAGES.find(p => p.id === packageId);
    if (!pkg) throw new Error("Invalid package selected");

    try {
      const response = await fetch('/.netlify/functions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId: pkg.id,
          userId: user.id,
          userEmail: user.email
        })
      });

      const data = await response.json().catch(() => ({ error: "The server response was not valid JSON." }));
      
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        const errorMsg = data.error || `Error ${response.status}: ${response.statusText}`;
        console.error("Stripe Checkout Error:", errorMsg);
        
        // Show a clear alert to the user if it's a configuration issue
        if (errorMsg.includes("Configuration Error")) {
          alert("Admin Configuration Required:\n\n" + errorMsg);
        } else {
          throw new Error(errorMsg);
        }
      }
    } catch (error: any) {
      console.error("Stripe Service Exception:", error);
      throw error;
    }
  }
};

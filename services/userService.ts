
import { UserProfile, PricingTier } from '../types';
import { supabase } from './supabaseClient';

export const PRICING_PACKAGES: PricingTier[] = [
  { 
    id: 'basic', 
    name: 'Personal (Basic)', 
    limit: 30, 
    price: 15.90, 
    description: 'For individuals managing monthly bills.',
    features: ['30 Receipts / Month', 'Standard Processing', 'Excel Export'],
    popular: false 
  },
  { 
    id: 'pro', 
    name: 'Freelancer (Pro)', 
    limit: 100, 
    price: 39.90, 
    description: 'For agents, freelancers & power users.',
    features: ['100 Receipts / Month', 'Priority AI Processing', 'Spending Analytics'],
    popular: true 
  },
  { 
    id: 'business', 
    name: 'SME (Business)', 
    limit: 500, 
    price: 89.90, 
    description: 'For small businesses and teams.',
    features: ['500 Receipts / Month', 'High-Speed Bulk Upload', 'Priority Support'],
    popular: false 
  }
];

const mapProfile = (data: any): UserProfile => ({
  id: data.id,
  name: data.name,
  email: data.email,
  avatarUrl: data.avatar_url,
  planId: data.plan_id || 'free',
  subscriptionExpiry: data.subscription_expiry,
  monthlyDocsLimit: data.monthly_docs_limit ?? 10, // Ensure never null/undefined
  docsUsedThisMonth: data.docs_used_this_month || 0,
  trialStartDate: data.trial_start_date,
  isTrialActive: data.is_trial_active,
  stripeCustomerId: data.stripe_customer_id
});

export const userService = {
  getProfile: async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return userService.refreshUserStatus(mapProfile(data));
  },

  login: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  },

  loginWithEmail: async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
  },

  verifyOtp: async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) throw error;
    return data;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Signout error:", error);
  },

  upsertProfile: async (authUser: any): Promise<UserProfile> => {
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (existing) return userService.refreshUserStatus(mapProfile(existing));

    const newProfile = {
      id: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
      email: authUser.email,
      avatar_url: authUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${authUser.email}&background=6366f1&color=fff`,
      plan_id: 'free',
      trial_start_date: Date.now(),
      is_trial_active: true,
      docs_used_this_month: 0,
      monthly_docs_limit: 10 
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(newProfile)
      .select()
      .single();

    if (error) throw error;
    return mapProfile(data);
  },

  refreshUserStatus: (user: UserProfile): UserProfile => {
    let updated = { ...user };
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isTrialExpired = (now - user.trialStartDate) > SEVEN_DAYS_MS;
    
    // Safety check for document limit
    if (updated.monthlyDocsLimit === 0 && updated.planId === 'free') {
       updated.monthlyDocsLimit = 10;
    }

    if (user.planId === 'free') {
        updated.isTrialActive = !isTrialExpired;
    } else {
        updated.isTrialActive = false;
    }

    if (user.planId !== 'free' && user.subscriptionExpiry) {
        if (now > user.subscriptionExpiry) {
            updated.planId = 'free';
            updated.monthlyDocsLimit = 0; // Lock account on expiry
            updated.subscriptionExpiry = null;
            updated.isTrialActive = false;
        }
    }
    return updated;
  },

  canUpload: (user: UserProfile, fileCount: number): { allowed: boolean; reason?: 'trial_limit' | 'plan_limit' | 'expired' } => {
    if (user.isTrialActive && user.planId === 'free') {
        if (user.docsUsedThisMonth + fileCount > user.monthlyDocsLimit) return { allowed: false, reason: 'trial_limit' };
        return { allowed: true };
    }
    if (user.planId !== 'free') {
        if (user.subscriptionExpiry && Date.now() > user.subscriptionExpiry) return { allowed: false, reason: 'expired' };
        if (user.docsUsedThisMonth + fileCount > user.monthlyDocsLimit) return { allowed: false, reason: 'plan_limit' };
        return { allowed: true };
    }
    return { allowed: false, reason: 'expired' };
  },

  recordUsage: async (user: UserProfile, fileCount: number): Promise<UserProfile> => {
    const newCount = (user.docsUsedThisMonth || 0) + fileCount;
    const { data, error } = await supabase
      .from('profiles')
      .update({ docs_used_this_month: newCount })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return mapProfile(data);
  }
};

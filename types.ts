export enum ExpenseCategory {
  FOOD = 'Food',
  UTILITY = 'Utility',
  TRANSPORT = 'Transport',
  HOTEL = 'Hotel',
  OTHERS = 'Others'
}

export interface ExpenseItem {
  id: string;
  vendorName: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  category: ExpenseCategory;
  summary: string; // Short description
  createdAt: number;
  fileName?: string;
  imageData?: string; // Base64 string of the receipt image
}

export interface Stats {
  totalAmount: number;
  count: number;
  categoryBreakdown: { name: string; value: number }[];
}

export type BudgetMap = Record<ExpenseCategory, number>;

export type SortField = 'date' | 'amount' | 'vendorName';
export type SortOrder = 'asc' | 'desc';

// --- New Types for Auth & Billing ---

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  
  // Subscription Fields
  planId: 'free' | 'basic' | 'pro' | 'business';
  subscriptionExpiry: number | null; // Timestamp
  monthlyDocsLimit: number;
  docsUsedThisMonth: number;
  
  trialStartDate: number; 
  isTrialActive: boolean;
}

export interface PricingTier {
  id: 'basic' | 'pro' | 'business';
  name: string;
  limit: number;
  price: number; // in MYR
  description: string;
  features: string[];
  popular?: boolean;
}
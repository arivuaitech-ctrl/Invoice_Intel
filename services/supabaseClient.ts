import { createClient } from '@supabase/supabase-js';

// We use a dummy URL if variables are missing to prevent the SDK from throwing a constructor error on load
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("CRITICAL: Supabase environment variables are missing. The app will fail to fetch data. Check Netlify Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
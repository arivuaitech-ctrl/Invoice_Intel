
import { createClient } from '@supabase/supabase-js';

// Fallbacks for the initial load if env variables are missing
const supabaseUrl = process.env.SUPABASE_URL || 'https://sliimickemtvqlrzprcj.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.warn("Supabase configuration missing: SUPABASE_URL is not defined.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

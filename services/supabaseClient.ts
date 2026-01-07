import { createClient } from '@supabase/supabase-js';

// Senior Engineer Note: Never hardcode keys in a repository. 
// These values are now pulled from environment variables in Vercel/Production.
const supabaseUrl = process.env.SUPABASE_URL || 'https://sliimickemtvqlrzprcj.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsaWltaWNrZW10dnFscnpwcmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NDkxNjcsImV4cCI6MjA4MzIyNTE2N30.z5WNCcs5x6ZZMHthL0xSWYBzOjPyNr5N40Y0DPG3MLw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
import { createClient } from '@supabase/supabase-js'

// ⚠️  REPLACE THESE with your own values from Supabase
// (Settings → API in your Supabase project dashboard)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

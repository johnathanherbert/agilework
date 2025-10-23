import { createClient } from '@supabase/supabase-js'

// Deprecated: Supabase is being replaced by Firebase
// This file is kept for backward compatibility with components not yet migrated
// TODO: Remove this file after all components are migrated to Firebase

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const getServerSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

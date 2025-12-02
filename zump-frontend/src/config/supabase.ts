/**
 * Supabase Configuration
 * Client initialization and configuration for Supabase backend
 * Requirements: 8.1
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Validate Supabase configuration
export const isSupabaseConfigured = (): boolean => {
  return SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
};

// Create Supabase client instance
let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY environment variables.'
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, // We use wallet auth, not Supabase auth
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    });
  }

  return supabaseClient;
};

// Reset client (useful for testing)
export const resetSupabaseClient = (): void => {
  supabaseClient = null;
};

// Export configuration values for reference
export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  storage: {
    tokenImagesBucket: 'token-images',
  },
  tables: {
    tokenMetadata: 'token_metadata',
    tradeEvents: 'trade_events',
    userPortfolios: 'user_portfolios',
  },
};

export default getSupabaseClient;

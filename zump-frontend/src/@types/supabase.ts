/**
 * Supabase Database Types
 * TypeScript types matching the Supabase schema
 * Requirements: 8.1, 8.2
 */

// ===========================================
// Token Metadata Types
// ===========================================

export interface TokenMetadata {
  token_address: string;
  pool_address: string | null;
  launch_id: number | null;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  creator_address: string;
  created_at: string;
  tags: string[];
  website_url: string | null;
  twitter_url: string | null;
  telegram_url: string | null;
}

export interface TokenMetadataInsert {
  token_address: string;
  pool_address?: string | null;
  launch_id?: number | null;
  name: string;
  symbol: string;
  description?: string | null;
  image_url?: string | null;
  creator_address: string;
  created_at?: string;
  tags?: string[];
  website_url?: string | null;
  twitter_url?: string | null;
  telegram_url?: string | null;
}

export interface TokenMetadataUpdate {
  pool_address?: string | null;
  launch_id?: number | null;
  name?: string;
  symbol?: string;
  description?: string | null;
  image_url?: string | null;
  tags?: string[];
  website_url?: string | null;
  twitter_url?: string | null;
  telegram_url?: string | null;
}

// ===========================================
// Trade Event Types
// ===========================================

export type TradeType = 'buy' | 'sell';

export interface TradeEvent {
  id: string;
  pool_address: string;
  trader: string;
  trade_type: TradeType;
  amount: string;
  price: string;
  cost_or_return: string;
  timestamp: string;
  tx_hash: string;
  block_number: number | null;
  created_at: string;
}

export interface TradeEventInsert {
  pool_address: string;
  trader: string;
  trade_type: TradeType;
  amount: string;
  price: string;
  cost_or_return: string;
  timestamp: string;
  tx_hash: string;
  block_number?: number | null;
}

// ===========================================
// User Portfolio Types
// ===========================================

export interface UserPortfolio {
  id: string;
  user_address: string;
  token_address: string;
  balance: string;
  last_updated: string;
}

export interface UserPortfolioInsert {
  user_address: string;
  token_address: string;
  balance: string;
}

export interface UserPortfolioUpdate {
  balance?: string;
  last_updated?: string;
}

// ===========================================
// Database Schema Type
// ===========================================

export interface Database {
  public: {
    Tables: {
      token_metadata: {
        Row: TokenMetadata;
        Insert: TokenMetadataInsert;
        Update: TokenMetadataUpdate;
      };
      trade_events: {
        Row: TradeEvent;
        Insert: TradeEventInsert;
        Update: never; // Trade events should not be updated
      };
      user_portfolios: {
        Row: UserPortfolio;
        Insert: UserPortfolioInsert;
        Update: UserPortfolioUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      trade_type: TradeType;
    };
  };
}

// ===========================================
// Query Filter Types
// ===========================================

export interface TradeEventFilter {
  poolAddress?: string;
  trader?: string;
  tradeType?: TradeType;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface TokenMetadataFilter {
  creatorAddress?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

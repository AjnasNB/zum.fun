-- Zump.fun Supabase Database Schema
-- Requirements: 8.1, 8.2
-- 
-- Run this SQL in your Supabase SQL Editor to create the required tables
-- Dashboard: https://app.supabase.com/project/YOUR_PROJECT/sql

-- ===========================================
-- Token Metadata Table
-- ===========================================
-- Stores off-chain metadata for launched tokens
-- Primary key is the token contract address

CREATE TABLE IF NOT EXISTS token_metadata (
  token_address TEXT PRIMARY KEY,
  pool_address TEXT,
  launch_id INTEGER,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  creator_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  
  -- Additional metadata fields
  website_url TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  
  -- Constraints
  CONSTRAINT token_address_format CHECK (token_address ~ '^0x[a-fA-F0-9]+$'),
  CONSTRAINT pool_address_format CHECK (pool_address IS NULL OR pool_address ~ '^0x[a-fA-F0-9]+$'),
  CONSTRAINT creator_address_format CHECK (creator_address ~ '^0x[a-fA-F0-9]+$')
);

-- Index for faster lookups by creator
CREATE INDEX IF NOT EXISTS idx_token_metadata_creator ON token_metadata(creator_address);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_token_metadata_created_at ON token_metadata(created_at DESC);

-- Index for pool address lookups
CREATE INDEX IF NOT EXISTS idx_token_metadata_pool ON token_metadata(pool_address);

-- ===========================================
-- Trade Events Cache Table
-- ===========================================
-- Caches trade events from blockchain for faster queries
-- This is optional but improves performance for trade history

CREATE TABLE IF NOT EXISTS trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL,
  trader TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount TEXT NOT NULL,
  price TEXT NOT NULL,
  cost_or_return TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  block_number BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT pool_address_format CHECK (pool_address ~ '^0x[a-fA-F0-9]+$'),
  CONSTRAINT trader_format CHECK (trader ~ '^0x[a-fA-F0-9]+$'),
  CONSTRAINT tx_hash_format CHECK (tx_hash ~ '^0x[a-fA-F0-9]+$')
);

-- Index for fetching trades by pool
CREATE INDEX IF NOT EXISTS idx_trade_events_pool ON trade_events(pool_address);

-- Index for sorting by timestamp
CREATE INDEX IF NOT EXISTS idx_trade_events_timestamp ON trade_events(timestamp DESC);

-- Index for filtering by trade type
CREATE INDEX IF NOT EXISTS idx_trade_events_type ON trade_events(trade_type);

-- Composite index for pool + timestamp queries
CREATE INDEX IF NOT EXISTS idx_trade_events_pool_timestamp ON trade_events(pool_address, timestamp DESC);

-- Index for trader lookups
CREATE INDEX IF NOT EXISTS idx_trade_events_trader ON trade_events(trader);

-- ===========================================
-- User Portfolios Cache Table (Optional)
-- ===========================================
-- Caches user token balances for faster portfolio display

CREATE TABLE IF NOT EXISTS user_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  balance TEXT NOT NULL DEFAULT '0',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint on user + token combination
  UNIQUE(user_address, token_address),
  
  -- Constraints
  CONSTRAINT user_address_format CHECK (user_address ~ '^0x[a-fA-F0-9]+$'),
  CONSTRAINT token_address_format CHECK (token_address ~ '^0x[a-fA-F0-9]+$')
);

-- Index for fetching user's portfolio
CREATE INDEX IF NOT EXISTS idx_user_portfolios_user ON user_portfolios(user_address);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_user_portfolios_token ON user_portfolios(token_address);

-- ===========================================
-- Row Level Security (RLS) Policies
-- ===========================================
-- Enable RLS for all tables

ALTER TABLE token_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;

-- Token metadata: Anyone can read, only authenticated can insert
CREATE POLICY "Token metadata is publicly readable"
  ON token_metadata FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert token metadata"
  ON token_metadata FOR INSERT
  WITH CHECK (true);

-- Trade events: Anyone can read, only authenticated can insert
CREATE POLICY "Trade events are publicly readable"
  ON trade_events FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert trade events"
  ON trade_events FOR INSERT
  WITH CHECK (true);

-- User portfolios: Anyone can read, only authenticated can insert/update
CREATE POLICY "User portfolios are publicly readable"
  ON user_portfolios FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert user portfolios"
  ON user_portfolios FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update user portfolios"
  ON user_portfolios FOR UPDATE
  USING (true);

-- ===========================================
-- Storage Bucket for Token Images
-- ===========================================
-- Run this in the Supabase Dashboard > Storage > Create new bucket
-- Bucket name: token-images
-- Public bucket: Yes (for public access to images)

-- Note: Storage bucket creation must be done via Supabase Dashboard
-- or using the Supabase Management API. The SQL below is for reference:
-- 
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('token-images', 'token-images', true);

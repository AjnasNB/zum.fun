# Zump.fun Frontend

A decentralized token launchpad frontend built with React and Starknet integration.

## Features

- **Token Launch**: Create new tokens with bonding curve pricing
- **Trading**: Buy and sell tokens through bonding curve pools
- **Real-time Prices**: Live price updates from on-chain data
- **Portfolio**: Track your token holdings and values
- **Trade History**: View all trading activity from blockchain events

## Prerequisites

- Node.js 18+
- npm or yarn
- Deployed Starknet contracts (see root README)
- Supabase project (for metadata storage)

## Quick Start

### 1. Install Dependencies

```bash
cd zump-frontend
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see Configuration Guide below).

### 3. Start Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

## Configuration Guide

### Contract Addresses

After deploying contracts (from root directory):

```bash
# From project root
npm run deploy
```

Copy the deployed addresses to your `.env` file:

```env
REACT_APP_PUMP_FACTORY_ADDRESS=0x...
REACT_APP_PROTOCOL_CONFIG_ADDRESS=0x...
```

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)

2. Run the database schema (from `supabase/schema.sql`):

```sql
-- Token metadata table
CREATE TABLE token_metadata (
  token_address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  creator_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags TEXT[],
  pool_address TEXT,
  launch_id INTEGER
);

-- Trade events cache
CREATE TABLE trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL,
  trader TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  amount TEXT NOT NULL,
  price TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trade_events_pool ON trade_events(pool_address);
CREATE INDEX idx_trade_events_timestamp ON trade_events(timestamp DESC);
```

3. Create a storage bucket for token images:
   - Go to Storage in Supabase dashboard
   - Create a bucket named `token-images`
   - Set it to public

4. Copy credentials to `.env`:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Network Configuration

For Sepolia testnet (default):
```env
REACT_APP_STARKNET_NETWORK=sepolia
REACT_APP_STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
```

For Mainnet:
```env
REACT_APP_STARKNET_NETWORK=mainnet
REACT_APP_STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io
```

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Project Structure

```
src/
├── abi/                 # Contract ABIs
├── components/          # Reusable UI components
│   ├── portfolio/       # Portfolio display
│   ├── price/           # Price display and charts
│   └── trading/         # Trading panel
├── config/              # Configuration files
│   ├── contracts.ts     # Contract addresses
│   └── supabase.ts      # Supabase client
├── hooks/               # Custom React hooks
│   ├── useTokenLaunch   # Token launch functionality
│   ├── useTokenList     # Token list fetching
│   ├── useTrading       # Buy/sell operations
│   └── usePortfolio     # Portfolio management
├── pages/               # Page components
├── redux/               # Redux state management
├── services/            # API services
│   ├── contractService  # Starknet contract calls
│   └── supabaseService  # Supabase operations
└── utils/               # Utility functions
```

## Troubleshooting

### Installation Issues

If `npm install` fails with peer dependency errors:
```bash
npm install --legacy-peer-deps
```

### Contract Connection Issues

1. Verify contract addresses in `.env`
2. Check RPC URL is accessible
3. Ensure wallet is connected to correct network

### Supabase Issues

1. Verify URL and anon key in `.env`
2. Check database schema is created
3. Ensure storage bucket exists and is public

## License

MIT

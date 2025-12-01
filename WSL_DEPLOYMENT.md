# 🐧 WSL Deployment Guide

Complete guide for deploying Pump.fun contracts using Windows Subsystem for Linux (WSL).

## Quick Start

```bash
# Make script executable
chmod +x scripts/deploy_wsl.sh

# Run deployment
./scripts/deploy_wsl.sh
```

## Prerequisites

The script will automatically check and install:

- ✅ **Scarb** - Cairo package manager (auto-installs if missing)
- ✅ **Node.js** - JavaScript runtime (must be installed)
- ✅ **npm** - Node package manager (comes with Node.js)
- ✅ **StarkNet CLI** - Contract declaration tool (auto-installs via pip if missing)

## Step-by-Step Manual Process

If you prefer to do it manually:

### 1. Install Prerequisites

**Scarb:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

**StarkNet CLI:**
```bash
pip3 install cairo-lang
# Or: pip install cairo-lang
```

**Node.js:**
```bash
# Install via package manager or download from nodejs.org
```

### 2. Setup Environment

Create/edit `.env` file:
```env
NETWORK=sepolia
RPC_URL=https://starknet-sepolia.publicnode.com
PRIVATE_KEY=your_private_key_here
ACCOUNT_ADDRESS=your_account_address_here
QUOTE_TOKEN=0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
```

### 3. Build Contracts

```bash
scarb build
```

### 4. Install Node Dependencies

```bash
npm install
```

### 5. Create StarkNet Account

```bash
starknet new_account --account deployer --network sepolia
```

Follow prompts to set a password. Account will be saved to `~/.starknet_accounts/`

### 6. Declare Contracts

```bash
# Declare all contracts
starknet declare --contract target/dev/pump_fun_ProtocolConfig.contract_class.json --account deployer --network sepolia
starknet declare --contract target/dev/pump_fun_PumpFactory.contract_class.json --account deployer --network sepolia
starknet declare --contract target/dev/pump_fun_PrivacyRelayer.contract_class.json --account deployer --network sepolia
starknet declare --contract target/dev/pump_fun_ZkDexHook.contract_class.json --account deployer --network sepolia
starknet declare --contract target/dev/pump_fun_LiquidityMigration.contract_class.json --account deployer --network sepolia
```

Or use the helper script:
```bash
chmod +x scripts/declare_all.sh
./scripts/declare_all.sh deployer sepolia
```

### 7. Deploy Instances

```bash
npm run deploy
```

## Troubleshooting

### "Scarb not found"
```bash
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

### "StarkNet CLI not found"
```bash
pip3 install cairo-lang
# If pip3 not found, install Python first
```

### "Account not found"
```bash
starknet new_account --account deployer --network sepolia
```

### "Class already declared"
This is fine! The deployment script will detect it and skip declaration.

### "Insufficient funds"
Fund your account with testnet ETH from a faucet.

### "RPC connection failed"
Update `RPC_URL` in `.env` to a working endpoint (see `RPC_SETUP.md`)

## Environment Variables

Required in `.env`:
- `PRIVATE_KEY` - Your StarkNet account private key
- `ACCOUNT_ADDRESS` - Your StarkNet account address
- `RPC_URL` - StarkNet RPC endpoint
- `QUOTE_TOKEN` - Quote token address (ETH on StarkNet)

Optional:
- `NETWORK` - Network name (default: sepolia)
- `DEX_ROUTER` - DEX router address for liquidity migration
- `PRIVACY_RELAYER_ADDRESS` - Privacy relayer address (set after deployment)

## What Gets Deployed

1. **ProtocolConfig** - Global protocol settings (fees, limits)
2. **PumpFactory** - Launch registry
3. **PrivacyRelayer** - ZK-shielded transaction relayer
4. **ZkDexHook** - Liquidity protection hooks
5. **LiquidityMigration** - DEX migration contract

## After Deployment

1. **Check deployment addresses:**
   ```bash
   cat deployments/sepolia.json
   ```

2. **Create your first launch:**
   ```bash
   npm run create-launch "MyToken" "MTK" "1000000000000000" "1000000000000" "1000000000000000000000000"
   ```

3. **Interact with contracts:**
   ```bash
   npm run interact factory total_launches
   ```

## Network Options

**Sepolia Testnet (default):**
```env
NETWORK=sepolia
RPC_URL=https://starknet-sepolia.publicnode.com
```

**Mainnet:**
```env
NETWORK=mainnet
RPC_URL=https://starknet-mainnet.publicnode.com
```

## Support

- See `DEPLOYMENT_GUIDE.md` for detailed deployment steps
- See `CONNECTION_DOCUMENTATION.md` for contract interaction examples
- See `RPC_SETUP.md` for RPC endpoint configuration


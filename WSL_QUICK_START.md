# 🚀 WSL Quick Start

## One-Command Deployment

```bash
# In WSL terminal
cd /mnt/d/pumb.fum
chmod +x scripts/deploy_wsl.sh
./scripts/deploy_wsl.sh
```

That's it! The script will:
1. ✅ Check and install prerequisites (Scarb, StarkNet CLI)
2. ✅ Build all contracts
3. ✅ Setup StarkNet account (if needed)
4. ✅ Declare all contracts
5. ✅ Deploy all contract instances

## Prerequisites Check

Before running, make sure you have:

- ✅ **.env file** with your credentials:
  ```env
  PRIVATE_KEY=your_private_key
  ACCOUNT_ADDRESS=your_account_address
  RPC_URL=https://starknet-sepolia.publicnode.com
  ```

- ✅ **Node.js** installed (the script will check)

## Manual Steps (if needed)

If the automated script doesn't work, follow these steps:

### 1. Install Scarb
```bash
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

### 2. Install StarkNet CLI
```bash
pip3 install cairo-lang
export PATH="$HOME/.local/bin:$PATH"
```

### 3. Build Contracts
```bash
scarb build
```

### 4. Install Node Dependencies
```bash
npm install
```

### 5. Create Account
```bash
starknet new_account --account deployer --network sepolia
```

### 6. Declare Contracts
```bash
chmod +x scripts/declare_all.sh
./scripts/declare_all.sh deployer sepolia
```

### 7. Deploy
```bash
npm run deploy
```

## Troubleshooting

**"Permission denied"**
```bash
chmod +x scripts/deploy_wsl.sh
chmod +x scripts/declare_all.sh
```

**"Scarb not found"**
```bash
export PATH="$HOME/.local/bin:$PATH"
```

**"StarkNet CLI not found"**
```bash
pip3 install cairo-lang --user
export PATH="$HOME/.local/bin:$PATH"
```

**"Account not found"**
```bash
starknet new_account --account deployer --network sepolia
```

## Files Created

- `scripts/deploy_wsl.sh` - Complete automated deployment
- `scripts/declare_all.sh` - Declare all contracts
- `WSL_DEPLOYMENT.md` - Detailed WSL guide
- `WSL_QUICK_START.md` - This file

## Next Steps

After deployment:

1. **Check addresses:**
   ```bash
   cat deployments/sepolia.json
   ```

2. **Create launch:**
   ```bash
   npm run create-launch "MyToken" "MTK" "1000000000000000" "1000000000000" "1000000000000000000000000"
   ```

3. **Interact:**
   ```bash
   npm run interact factory total_launches
   ```

## Support

See `WSL_DEPLOYMENT.md` for detailed instructions.


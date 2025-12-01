# How to Fund Your Account on StarkNet Sepolia

## 🚨 Your Account Address
```
0x01F8e1be9Ee553a7FC575437Df3753E5A3A86eCDc651b48efd9F1E873cf2b2bB
```

## Method 1: Use StarkNet Sepolia Faucet (Easiest)

### Option A: StarkNet Faucet (Recommended)
1. Visit: **https://starknet-faucet.vercel.app/**
2. Connect your wallet (ArgentX, Braavos, etc.)
3. Select **Sepolia** network
4. Enter your account address: `0x01F8e1be9Ee553a7FC575437Df3753E5A3A86eCDc651b48efd9F1E873cf2b2bB`
5. Request ETH (usually 0.1-0.5 ETH per request)
6. Wait for confirmation (~1-2 minutes)

### Option B: QuickNode Faucet
1. Visit: **https://faucet.quicknode.com/starknet/sepolia**
2. Enter your account address
3. Complete any required verification
4. Request ETH

### Option C: StarkNet Official Faucet
1. Visit: **https://starknet-faucet.publicworks.art/**
2. Enter your account address
3. Request ETH

## Method 2: Bridge from Ethereum Sepolia to StarkNet Sepolia

### Step 1: Get Ethereum Sepolia ETH
1. Visit: **https://sepoliafaucet.com/** or **https://faucet.quicknode.com/ethereum/sepolia**
2. Request Ethereum Sepolia ETH to your Ethereum wallet address
3. Wait for confirmation

### Step 2: Bridge to StarkNet Sepolia

#### Option A: Using StarkGate Bridge
1. Visit: **https://starkgate.starknet.io/**
2. Connect your wallet
3. Select **Sepolia → Sepolia** (Ethereum Sepolia to StarkNet Sepolia)
4. Enter amount to bridge
5. Approve and bridge
6. Wait for confirmation (~10-15 minutes)

#### Option B: Using Orbiter Finance
1. Visit: **https://www.orbiter.finance/**
2. Connect wallet
3. Select:
   - **From**: Ethereum Sepolia
   - **To**: StarkNet Sepolia
4. Enter amount
5. Bridge

#### Option C: Using Layerswap
1. Visit: **https://www.layerswap.io/**
2. Connect wallet
3. Select Ethereum Sepolia → StarkNet Sepolia
4. Bridge

## Method 3: Use ArgentX or Braavos Wallet

If you have ArgentX or Braavos wallet:

1. **Install ArgentX**: https://www.argent.xyz/argent-x
   - Or **Braavos**: https://braavos.app/

2. **Import your account** using your private key:
   ```
   PRIVATE_KEY from .env file
   ```

3. **Use in-wallet faucet**:
   - ArgentX has built-in faucet access
   - Request Sepolia ETH directly from wallet

## ⚡ Quick Steps (Recommended)

1. **Go to**: https://starknet-faucet.vercel.app/
2. **Connect wallet** (or use manual address entry)
3. **Paste address**: `0x01F8e1be9Ee553a7FC575437Df3753E5A3A86eCDc651b48efd9F1E873cf2b2bB`
4. **Request ETH** (0.1-0.5 ETH)
5. **Wait 1-2 minutes**
6. **Run**: `npm run deploy`

## 💰 Recommended Amount

- **Minimum**: 0.05 ETH (for testing)
- **Recommended**: 0.1-0.2 ETH (for full deployment)
- **Safe**: 0.5 ETH (for multiple deployments)

## ✅ Verify Balance

After funding, verify your balance:

```bash
# The deploy script will check automatically
npm run deploy
```

Or check manually:
```bash
# View on StarkScan
https://sepolia.starkscan.co/address/0x01F8e1be9Ee553a7FC575437Df3753E5A3A86eCDc651b48efd9F1E873cf2b2bB
```

## 🔗 Useful Links

- **StarkScan (Explorer)**: https://sepolia.starkscan.co/
- **StarkNet Faucet**: https://starknet-faucet.vercel.app/
- **StarkGate Bridge**: https://starkgate.starknet.io/
- **ArgentX Wallet**: https://www.argent.xyz/argent-x
- **Braavos Wallet**: https://braavos.app/

## ⚠️ Important Notes

1. **Network**: Make sure you're on **StarkNet Sepolia** (not mainnet)
2. **Wait Time**: Faucet requests usually take 1-2 minutes
3. **Bridge Time**: Bridging from Ethereum takes 10-15 minutes
4. **Gas Fees**: You need ETH to pay for transaction fees
5. **Account**: Your account address is derived from your private key - it's the same address on all networks

## 🆘 Troubleshooting

### Faucet not working?
- Try different faucet
- Check if you've already requested recently (cooldown period)
- Verify you're requesting for Sepolia network

### Bridge not working?
- Ensure you have Ethereum Sepolia ETH first
- Check bridge status on explorer
- Wait for confirmation (can take 10-15 minutes)

### Still 0 balance?
- Wait a few more minutes
- Check on StarkScan: https://sepolia.starkscan.co/address/0x01F8e1be9Ee553a7FC575437Df3753E5A3A86eCDc651b48efd9F1E873cf2b2bB
- Verify you sent to the correct address


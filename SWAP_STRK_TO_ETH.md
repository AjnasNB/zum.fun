# How to Swap STRK to ETH on StarkNet Sepolia

## 🚨 Important
**You need ETH to pay for gas fees on StarkNet, not STRK!**

If you have STRK tokens, you need to swap them to ETH first.

## 🔄 Quick Swap Guide

### Step 1: Connect Your Wallet

You need to import your account into a wallet:

1. **Install ArgentX or Braavos**:
   - ArgentX: https://www.argent.xyz/argent-x
   - Braavos: https://braavos.app/

2. **Import your account**:
   - Use your **PRIVATE_KEY** from `.env` file
   - Or import using seed phrase if you have one

### Step 2: Swap STRK to ETH

#### Option A: JediSwap (Recommended)
1. Visit: **https://app.jediswap.xyz/**
2. Connect your wallet (ArgentX/Braavos)
3. Make sure you're on **StarkNet Sepolia** network
4. Select:
   - **From**: STRK
   - **To**: ETH
5. Enter amount to swap
6. Approve and swap
7. Wait for confirmation

#### Option B: Ekubo
1. Visit: **https://app.ekubo.org/**
2. Connect wallet
3. Select STRK → ETH
4. Swap

#### Option C: 10KSwap
1. Visit: **https://10kswap.com/**
2. Connect wallet
3. Select STRK → ETH
4. Swap

### Step 3: Verify ETH Balance

After swapping, check your balance:
```bash
npm run deploy
```

Or check on StarkScan:
```
https://sepolia.starkscan.co/address/0x01F8e1be9Ee553a7FC575437Df3753E5A3A86eCDc651b48efd9F1E873cf2b2bB
```

## 💡 Alternative: Use STRK Directly (If Supported)

Some newer StarkNet setups might support STRK for gas. If you want to try:

1. Check if your RPC supports STRK gas
2. Some wallets allow paying gas in STRK
3. But for contract deployment, ETH is usually required

## ⚠️ Important Notes

1. **Gas Fees**: Contract deployment requires ETH, not STRK
2. **Network**: Make sure you're on **StarkNet Sepolia**
3. **Slippage**: Set appropriate slippage (1-3%) when swapping
4. **Minimum**: Keep some ETH for gas (0.01-0.05 ETH minimum)

## 🔗 Useful Links

- **JediSwap**: https://app.jediswap.xyz/
- **Ekubo**: https://app.ekubo.org/
- **10KSwap**: https://10kswap.com/
- **StarkScan**: https://sepolia.starkscan.co/
- **ArgentX**: https://www.argent.xyz/argent-x
- **Braavos**: https://braavos.app/

## 🆘 Troubleshooting

### Can't connect wallet?
- Make sure wallet extension is installed
- Refresh the DEX page
- Try different browser

### Swap failing?
- Check you have enough STRK
- Verify you're on Sepolia network
- Increase slippage tolerance
- Check liquidity pool exists

### Still need ETH?
- After swapping, wait for confirmation
- Check balance on StarkScan
- Run deploy script again


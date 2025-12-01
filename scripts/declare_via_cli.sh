#!/bin/bash
# Script to declare contracts via StarkNet CLI
# Usage: ./scripts/declare_via_cli.sh <account_name>

ACCOUNT=${1:-"deployer"}
NETWORK=${2:-"sepolia"}

echo "🔨 Declaring contracts via StarkNet CLI..."
echo "Account: $ACCOUNT"
echo "Network: $NETWORK"
echo ""

CONTRACTS=(
  "ProtocolConfig"
  "PumpFactory"
  "PrivacyRelayer"
  "ZkDexHook"
  "LiquidityMigration"
)

for contract in "${CONTRACTS[@]}"; do
  echo "📦 Declaring $contract..."
  starknet declare \
    --contract target/dev/pump_fun_${contract}.contract_class.json \
    --account $ACCOUNT \
    --network $NETWORK
  
  if [ $? -eq 0 ]; then
    echo "✅ $contract declared successfully"
  else
    echo "❌ Failed to declare $contract"
  fi
  echo ""
done

echo "✅ All contracts declared!"


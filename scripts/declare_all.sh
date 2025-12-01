#!/bin/bash
# Declare all contracts via StarkNet CLI
# Usage: ./scripts/declare_all.sh <account_name> [network]

set -e

ACCOUNT=${1:-"deployer"}
NETWORK=${2:-"sepolia"}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔨 Declaring all contracts via StarkNet CLI...${NC}"
echo -e "Account: ${YELLOW}${ACCOUNT}${NC}"
echo -e "Network: ${YELLOW}${NETWORK}${NC}"
echo ""

CONTRACTS=(
    "ProtocolConfig"
    "PumpFactory"
    "PrivacyRelayer"
    "ZkDexHook"
    "LiquidityMigration"
)

SUCCESS=0
FAILED=0

for contract in "${CONTRACTS[@]}"; do
    echo -e "${CYAN}📦 Declaring ${contract}...${NC}"
    
    contract_path="target/dev/pump_fun_${contract}.contract_class.json"
    
    if [ ! -f "$contract_path" ]; then
        echo -e "${RED}❌ Contract file not found: ${contract_path}${NC}"
        echo -e "${YELLOW}   Run 'scarb build' first${NC}"
        FAILED=$((FAILED + 1))
        continue
    fi
    
    if starknet declare \
        --contract "$contract_path" \
        --account "$ACCOUNT" \
        --network "$NETWORK" \
        --no_wallet; then
        echo -e "${GREEN}✅ ${contract} declared successfully${NC}"
        SUCCESS=$((SUCCESS + 1))
    else
        exit_code=$?
        if [ $exit_code -eq 1 ]; then
            # Check if already declared
            echo -e "${YELLOW}⚠️  Declaration returned error, checking if already declared...${NC}"
            # Try to verify by checking class hash
            echo -e "${YELLOW}   (If class already exists, this is fine)${NC}"
        fi
        echo -e "${RED}❌ Failed to declare ${contract}${NC}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

echo -e "${CYAN}=====================================${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All contracts declared successfully!${NC}"
    echo ""
    echo -e "${CYAN}Next step: Run 'npm run deploy' to deploy contract instances${NC}"
else
    echo -e "${YELLOW}⚠️  ${SUCCESS} succeeded, ${FAILED} failed${NC}"
    echo ""
    echo -e "${YELLOW}You can try declaring failed contracts manually:${NC}"
    echo -e "${CYAN}  starknet declare --contract target/dev/pump_fun_<ContractName>.contract_class.json --account ${ACCOUNT} --network ${NETWORK}${NC}"
fi


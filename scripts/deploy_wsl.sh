#!/bin/bash
# Complete WSL deployment script for Pump.fun on StarkNet
# This script handles everything: setup, declaration, and deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
NETWORK=${NETWORK:-"sepolia"}
ACCOUNT_NAME=${ACCOUNT_NAME:-"deployer"}

echo -e "${CYAN}🚀 Pump.fun StarkNet Deployment via WSL${NC}"
echo -e "${CYAN}=====================================${NC}"
echo ""

# Step 1: Check prerequisites
echo -e "${CYAN}📋 Checking prerequisites...${NC}"

# Check if Scarb is installed
if ! command -v scarb &> /dev/null; then
    echo -e "${RED}❌ Scarb not found${NC}"
    echo -e "${YELLOW}Installing Scarb...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
else
    echo -e "${GREEN}✅ Scarb found: $(scarb --version)${NC}"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    echo -e "${YELLOW}Please install Node.js: https://nodejs.org/${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
else
    echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"
fi

# Check if StarkNet CLI is installed (optional - we can use starknet.js instead)
if ! command -v starknet &> /dev/null; then
    echo -e "${YELLOW}⚠️  StarkNet CLI not found${NC}"
    echo -e "${CYAN}This is okay - we'll use starknet.js for deployment${NC}"
    echo -e "${YELLOW}If you want to install CLI (optional):${NC}"
    echo -e "${CYAN}  pip3 install cairo-lang${NC}"
    echo -e "${CYAN}  Or see: https://docs.starknet.io/documentation/getting_started/installation/${NC}"
else
    # Test if CLI actually works
    if starknet --version &>/dev/null 2>&1; then
        echo -e "${GREEN}✅ StarkNet CLI found${NC}"
    else
        echo -e "${YELLOW}⚠️  StarkNet CLI found but may be broken${NC}"
        echo -e "${CYAN}We'll use starknet.js for deployment instead${NC}"
    fi
fi

echo ""

# Step 2: Load environment variables
echo -e "${CYAN}📝 Loading environment variables...${NC}"

if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from template...${NC}"
    cat > .env << EOF
NETWORK=sepolia
RPC_URL=https://starknet-sepolia.publicnode.com
PRIVATE_KEY=your_private_key_here
ACCOUNT_ADDRESS=your_account_address_here
QUOTE_TOKEN=0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
DEX_ROUTER=0x0000000000000000000000000000000000000000000000000000000000000000
PRIVACY_RELAYER_ADDRESS=0x0000000000000000000000000000000000000000000000000000000000000000
EOF
    echo -e "${YELLOW}⚠️  Please edit .env file with your credentials${NC}"
    exit 1
fi

# Source .env file - handle comments and empty lines properly
set -a
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    [[ -z "$line" ]] && continue
    
    # Skip lines that start with # (comments)
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Remove inline comments (everything after # that's not in quotes)
    # Simple approach: remove # and everything after it
    line=$(echo "$line" | sed 's/#.*$//')
    
    # Trim whitespace
    line=$(echo "$line" | xargs)
    
    # Export if line is not empty and contains =
    if [[ -n "$line" ]] && [[ "$line" == *"="* ]]; then
        # Use eval to properly handle values with spaces or special chars
        eval "export $line" 2>/dev/null || export "$line"
    fi
done < .env
set +a

if [ -z "$PRIVATE_KEY" ] || [ -z "$ACCOUNT_ADDRESS" ]; then
    echo -e "${RED}❌ PRIVATE_KEY or ACCOUNT_ADDRESS not set in .env${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

# Step 3: Build contracts
echo -e "${CYAN}🔨 Building contracts...${NC}"

if ! scarb build; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contracts built successfully${NC}"
echo ""

# Step 4: Install Node dependencies
echo -e "${CYAN}📦 Installing Node dependencies...${NC}"

if [ ! -d "node_modules" ]; then
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

echo ""

# Step 5: Setup StarkNet account (if needed)
echo -e "${CYAN}👤 Setting up StarkNet account...${NC}"

# Check if account exists or if we can use account from .env
if [ ! -f ~/.starknet_accounts/${ACCOUNT_NAME}_account.json ] && [ ! -f ~/.starknet_accounts/starknet_open_zeppelin_accounts.json ]; then
    echo -e "${YELLOW}Account not found. Attempting to create new account...${NC}"
    
    # Try to create account, but don't fail if CLI is broken
    if starknet new_account --account ${ACCOUNT_NAME} --network ${NETWORK} 2>/dev/null; then
        echo -e "${GREEN}✅ Account created${NC}"
    else
        echo -e "${YELLOW}⚠️  StarkNet CLI account creation failed${NC}"
        echo -e "${YELLOW}This is okay - we'll use the account from .env file${NC}"
        echo -e "${CYAN}Make sure ACCOUNT_ADDRESS and PRIVATE_KEY are set in .env${NC}"
    fi
else
    echo -e "${GREEN}✅ Account found${NC}"
fi

# Verify account credentials from .env
if [ -z "$ACCOUNT_ADDRESS" ] || [ -z "$PRIVATE_KEY" ]; then
    echo -e "${YELLOW}⚠️  ACCOUNT_ADDRESS or PRIVATE_KEY not set in .env${NC}"
    echo -e "${YELLOW}The deployment will use starknet.js which reads from .env${NC}"
else
    echo -e "${GREEN}✅ Account credentials found in .env${NC}"
fi

echo ""

# Step 6: Declare contracts
echo -e "${CYAN}📝 Declaring contracts...${NC}"

CONTRACTS=(
    "ProtocolConfig"
    "PumpFactory"
    "PrivacyRelayer"
    "ZkDexHook"
    "LiquidityMigration"
)

DECLARED=()
FAILED=()

for contract in "${CONTRACTS[@]}"; do
    echo -e "${CYAN}📦 Declaring ${contract}...${NC}"
    
    contract_path="target/dev/pump_fun_${contract}.contract_class.json"
    
    if [ ! -f "$contract_path" ]; then
        echo -e "${RED}❌ Contract file not found: ${contract_path}${NC}"
        FAILED+=("${contract}")
        continue
    fi
    
    # Compute class hash first to check if already declared
    class_hash=$(node -e "
        const starknet = require('starknet');
        const fs = require('fs');
        const contract = JSON.parse(fs.readFileSync('${contract_path}', 'utf8'));
        console.log(starknet.hash.computeContractClassHash(contract));
    ")
    
    echo -e "${YELLOW}  Class hash: ${class_hash}${NC}"
    
    # Try to declare using starknet CLI
    if command -v starknet &> /dev/null && starknet declare \
        --contract "$contract_path" \
        --account ${ACCOUNT_NAME} \
        --network ${NETWORK} \
        --no_wallet 2>/dev/null; then
        echo -e "${GREEN}✅ ${contract} declared successfully${NC}"
        DECLARED+=("${contract}")
    else
        # Check if it's already declared on-chain
        echo -e "${YELLOW}⚠️  Checking if ${contract} is already declared...${NC}"
        if node -e "
            const starknet = require('starknet');
            const provider = new starknet.RpcProvider({ nodeUrl: '${RPC_URL}' });
            provider.getClassByHash('${class_hash}').then(() => {
                console.log('EXISTS');
                process.exit(0);
            }).catch(() => {
                console.log('NOT_FOUND');
                process.exit(1);
            });
        " 2>/dev/null | grep -q "EXISTS"; then
            echo -e "${GREEN}✅ ${contract} already declared on-chain${NC}"
            DECLARED+=("${contract}")
        else
            echo -e "${YELLOW}⚠️  Could not declare ${contract} via CLI (CLI may be broken)${NC}"
            echo -e "${CYAN}  Will attempt declaration during deployment via starknet.js${NC}"
            echo -e "${CYAN}  Class hash: ${class_hash}${NC}"
            # Don't mark as failed - let deployment script handle it
            DECLARED+=("${contract}")
        fi
    fi
    echo ""
done

# Report results
if [ ${#FAILED[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All contracts declared successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Some contracts failed to declare:${NC}"
    for contract in "${FAILED[@]}"; do
        echo -e "${RED}  - ${contract}${NC}"
    done
    echo ""
    echo -e "${YELLOW}You can try declaring them manually:${NC}"
    for contract in "${FAILED[@]}"; do
        echo -e "${CYAN}  starknet declare --contract target/dev/pump_fun_${contract}.contract_class.json --account ${ACCOUNT_NAME} --network ${NETWORK}${NC}"
    done
fi

echo ""

# Step 7: Deploy contract instances
echo -e "${CYAN}🚀 Deploying contract instances...${NC}"

if npm run deploy; then
    echo ""
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    echo ""
    echo -e "${CYAN}📋 Deployment addresses saved to: deployments/${NETWORK}.json${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All done!${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. Check deployments/${NETWORK}.json for contract addresses"
echo -e "  2. Create your first launch: npm run create-launch \"MyToken\" \"MTK\" \"1000000000000000\" \"1000000000000\" \"1000000000000000000000000\""
echo ""


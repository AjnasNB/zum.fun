#!/bin/bash
# Complete setup and deployment script for WSL
# This script installs everything and deploys all contracts

set -e

echo "🚀 Pump.fun Complete Setup & Deployment"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if we're in WSL
if [ -z "$WSL_DISTRO_NAME" ] && [ -z "$WSLENV" ]; then
    echo -e "${YELLOW}⚠️  Not running in WSL. This script is designed for WSL.${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Load .env file if exists - handle comments and empty lines properly
if [ -f .env ]; then
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip empty lines
        [[ -z "$line" ]] && continue
        
        # Skip lines that start with # (comments)
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        
        # Remove inline comments (everything after #)
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
fi

NETWORK=${NETWORK:-"sepolia"}
ACCOUNT_NAME=${ACCOUNT_NAME:-"deployer"}

echo -e "${CYAN}📋 Configuration:${NC}"
echo "  Network: $NETWORK"
echo "  Account: $ACCOUNT_NAME"
echo ""

# Step 1: Install Python and pip if not installed
echo -e "${CYAN}Step 1: Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo "Installing Python3..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip
fi
python3 --version
echo ""

# Step 2: Install StarkNet CLI
echo -e "${CYAN}Step 2: Installing StarkNet CLI...${NC}"
if ! command -v starknet &> /dev/null; then
    echo "Installing cairo-lang (StarkNet CLI)..."
    # Try compatible version for Python 3.12
    pip3 install "cairo-lang<0.14.0" --break-system-packages --user || \
    pip3 install "cairo-lang==0.13.1" --break-system-packages --user || \
    pip3 install cairo-lang --break-system-packages --user
    export PATH="$HOME/.local/bin:$PATH"
    
    # Verify installation
    if ! command -v starknet &> /dev/null; then
        echo -e "${YELLOW}⚠️  StarkNet CLI not in PATH. Trying to use directly...${NC}"
        STARKNET_CMD="$HOME/.local/bin/starknet"
        if [ ! -f "$STARKNET_CMD" ]; then
            echo -e "${RED}❌ StarkNet CLI installation failed${NC}"
            echo "Try manually: pip3 install 'cairo-lang<0.14.0'"
            exit 1
        fi
        alias starknet="$STARKNET_CMD"
    fi
fi

# Test starknet command
if command -v starknet &> /dev/null; then
    starknet --version || $HOME/.local/bin/starknet --version
else
    export PATH="$HOME/.local/bin:$PATH"
    starknet --version || echo "StarkNet CLI installed but may need PATH update"
fi
echo ""

# Step 3: Build contracts
echo -e "${CYAN}Step 3: Building contracts...${NC}"
if [ ! -f "scarb" ] && [ ! -f "./scarb" ]; then
    echo "Scarb not found. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
fi

if command -v scarb &> /dev/null; then
    scarb build
    echo -e "${GREEN}✅ Contracts built${NC}"
else
    echo -e "${YELLOW}⚠️  Scarb not found. Using pre-built contracts if available.${NC}"
fi
echo ""

# Step 4: Setup account
echo -e "${CYAN}Step 4: Setting up StarkNet account...${NC}"
if [ ! -f ~/.starknet_accounts/starknet_open_zeppelin_accounts.json ]; then
    echo "Creating new account..."
    starknet new_account --account $ACCOUNT_NAME --network $NETWORK
    echo -e "${GREEN}✅ Account created${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: Save your account details!${NC}"
else
    echo -e "${GREEN}✅ Account already exists${NC}"
fi
echo ""

# Step 5: Declare contracts
echo -e "${CYAN}Step 5: Declaring contracts...${NC}"
CONTRACTS=(
    "ProtocolConfig"
    "PumpFactory"
    "PrivacyRelayer"
    "ZkDexHook"
    "LiquidityMigration"
)

FAILED=()

for contract in "${CONTRACTS[@]}"; do
    echo -e "${CYAN}📦 Declaring $contract...${NC}"
    
    CONTRACT_PATH="target/dev/pump_fun_${contract}.contract_class.json"
    
    if [ ! -f "$CONTRACT_PATH" ]; then
        echo -e "${RED}❌ Contract file not found: $CONTRACT_PATH${NC}"
        FAILED+=("$contract")
        continue
    fi
    
    # Use starknet command (handle PATH issues)
    STARKNET_CMD=$(command -v starknet || echo "$HOME/.local/bin/starknet")
    if $STARKNET_CMD declare --contract "$CONTRACT_PATH" --account $ACCOUNT_NAME --network $NETWORK; then
        echo -e "${GREEN}✅ $contract declared${NC}"
    else
        echo -e "${RED}❌ Failed to declare $contract${NC}"
        FAILED+=("$contract")
    fi
    echo ""
done

if [ ${#FAILED[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some contracts failed to declare:${NC}"
    for contract in "${FAILED[@]}"; do
        echo -e "  ${RED}- $contract${NC}"
    done
    echo ""
    read -p "Continue with deployment anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Step 6: Install Node dependencies
echo -e "${CYAN}Step 6: Installing Node dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi
echo ""

# Step 7: Deploy contracts
echo -e "${CYAN}Step 7: Deploying contract instances...${NC}"
echo "Running npm run deploy..."
cd /mnt/d/pumb.fum 2>/dev/null || cd "$(dirname "$0")/.."
npm run deploy

echo ""
echo -e "${GREEN}✅ Setup and deployment complete!${NC}"
echo ""
echo -e "${CYAN}📋 Next steps:${NC}"
echo "  1. Check deployments/sepolia.json for contract addresses"
echo "  2. Create your first launch: npm run create-launch"
echo "  3. See CONNECTION_DOCUMENTATION.md for usage examples"


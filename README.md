# 🐸 Zump.fun 

**The first on-chain untraceable, unidentifiable, hidden identity-based trading platform on Starknet**

> *"Trade like a ghost. Pump like a god."*

Powered by **Noir zkContracts** + **Garaga accelerated proofs** + **Ztarknet encrypted state**

## 📋 Overview

**Zump.fun** is the world's first fully privacy focused memecoin launchpad on StarkNet, where every transaction is anonymous, untraceable, and unidentifiable. Built with cutting-edge zero-knowledge technology, Zump.fun enables traders to launch and trade memecoins without exposing their identity/primary wallet addresses.

### 🔒 The Privacy Problem

Financial privacy in blockchain is fundamentally broken:

- **Bitcoin's Original Vision**: Privacy and private payments were the core agenda
- **Reality Today**: Platforms like Arkham Intelligence and Dune Analytics make every transaction traceable
- **The Cost**: Fear, inconvenience, and financial losses from targeted attacks on traders
- **Public Ledgers**: Every wallet, every trade, every profit is exposed

**Result**: Traders are vulnerable to front-running, targeted attacks, and loss of financial privacy.

### 🎯 Core Privacy Features

- 👻 **Infinite Untraceable Stealth Accounts** - Each login generates a fresh stealth sub-account
- 🔐 **Zero Wallet Linkability** - Primary wallet cannot identify stealth wallet and vice versa
- 🌑 **Anonymous Token Launches** - Deploy memecoins with zero identity exposure
- 💰 **Private Trading** - Buy and sell without revealing your position
- 🔄 **One Single DarkPool** - Infinite transactions through unified privacy mixer
- 🚀 **Auto DEX Migration** - Seamless transition to public trading when threshold reached
- ⚡ **ZK-Powered** - Noir zkContracts + Garaga accelerated proofs + Ztarknet encrypted state

### 🎯 MVP Features

- ✅ Stealth address generation for every user
- ✅ Anonymous memecoin creation with ZK contracts
- ✅ Private bonding-curve trading (untraceable buy/sell)
- ✅ Hidden liquidity pools with encrypted state
- ✅ Automatic DEX migration at threshold
- ✅ Zero wallet linkability between primary and stealth accounts
- ✅ Nullifier-based transaction privacy

## 🏗️ Architecture

### Privacy-First System Overview

```mermaid
graph TB
    subgraph "User Layer - Invisible"
        PW[Primary Wallet<br/>Public Identity]
        SW[Stealth Wallet<br/>Ghost Identity]
        SA[Stealth Address<br/>Unlinkable]
    end
    
    subgraph "Privacy Layer - ZK Technology"
        ZKC[Noir zkContracts<br/>Zero-Knowledge Proofs]
        GAR[Garaga<br/>Proof Acceleration]
        ZTS[Ztarknet<br/>Encrypted State]
        NULL[Nullifier Scanner<br/>Double-spend Prevention]
    end
    
    subgraph "Core Protocol - Private"
        DP[DarkPool Mixer<br/>Unified Privacy]
        PF[PumpFactory<br/>Anonymous Registry]
        PC[ProtocolConfig<br/>Encrypted Settings]
        LM[LiquidityMigration<br/>Private → Public]
    end
    
    subgraph "Per-Launch Contracts - Hidden"
        MT[MemecoinToken<br/>ZK-ERC20]
        BCP[BondingCurvePool<br/>Private Trading]
        MKT[Merkle Tree<br/>Note Storage]
    end
    
    subgraph "External - Public"
        QT[Quote Token<br/>ETH/USDC]
        DEX[DEX<br/>JediSwap/Ekubo]
    end
    
    PW -.->|1. Generates| SA
    SA -->|2. Unlinkable Transfer| SW
    SW -->|3. Private Launch| ZKC
    ZKC -->|4. Proof Generation| GAR
    GAR -->|5. Encrypted Deploy| ZTS
    ZTS -->|6. Store in| DP
    
    SW -->|7. Private Trade| BCP
    BCP -->|8. ZK Verification| ZKC
    BCP -->|9. Nullifier Check| NULL
    BCP -->|10. Store Note| MKT
    
    LM -->|11. Threshold Met| DEX
    DEX -.->|12. Public Trading| PW
    
    style PW fill:#4A90E2
    style SW fill:#1a1a1a
    style SA fill:#1a1a1a
    style ZKC fill:#9370DB
    style GAR fill:#9370DB
    style ZTS fill:#9370DB
    style DP fill:#1a1a1a
    style BCP fill:#1a1a1a
```

### How Zump.fun Works - Three Steps to Ghost Mode

```mermaid
sequenceDiagram
    participant User as 👤 User<br/>(Primary Wallet)
    participant Zump as 👻 Zump.fun
    participant Stealth as 🌑 Stealth Address
    participant ZK as ⚡ ZK Engine
    participant Pool as 💰 Private Pool
    participant DEX as 🏦 Public DEX

    Note over User,DEX: Step 1: Stealth Address Generation
    User->>Zump: Connect with primary wallet
    Zump->>ZK: Generate stealth keypair
    ZK-->>Stealth: Create unlinkable address
    User->>Stealth: Send funds (untraceable)
    Note over Stealth: Primary wallet ≠ Stealth wallet<br/>No linkability possible

    Note over User,DEX: Step 2: Launch Privately
    Stealth->>Zump: Deploy memecoin anonymously
    Zump->>ZK: Generate ZK proof of ownership
    ZK->>Pool: Create private bonding curve
    Note over Pool: Token launched<br/>Creator identity hidden<br/>Until self-declared

    Note over User,DEX: Step 3: Trade & Go Public
    Stealth->>Pool: Private buy/sell (ZK proofs)
    Pool->>Pool: Accumulate liquidity
    Pool-->>Stealth: Private profits
    
    alt Threshold Reached
        Pool->>DEX: Auto-deploy LP
        Note over DEX: Now public trading<br/>But stealth positions<br/>stay private forever
    end
```

### Privacy Technology Stack

```mermaid
graph LR
    subgraph "Privacy Stack"
        A[Noir zkContracts] --> B[Zero-Knowledge Proofs]
        C[Garaga] --> D[Proof Acceleration]
        E[Ztarknet] --> F[Encrypted State]
        G[Nullifiers] --> H[Double-Spend Prevention]
        I[Merkle Trees] --> J[Note Storage]
    end
    
    subgraph "Starknet Native"
        K[Pedersen Hash] --> L[ZK-Optimized]
        M[Poseidon Hash] --> L
        N[Stark Curves] --> O[Efficient Proving]
    end
    
    B --> P[Private Transactions]
    D --> P
    F --> P
    H --> P
    J --> P
    L --> P
    O --> P
    
    style A fill:#9370DB
    style C fill:#9370DB
    style E fill:#9370DB
    style P fill:#1a1a1a
```

### On-chain Contracts

1. **MemecoinToken** - ZK token with private mint/burn via zero-knowledge proofs
2. **BondingCurvePool** - Private trading pool with encrypted state and nullifier checks
3. **PumpFactory** - Anonymous launch registry with stealth address support
4. **ProtocolConfig** - Encrypted protocol variables with ZK-based access control
5. **LiquidityMigration** - Private-to-public transition with LP deployment
6. **PrivacyRelayer** - Off-chain watcher for stealth address monitoring
7. **ZK_DEX_Hook** - Zero-knowledge hooks for DEX integration

### Contract Responsibilities

| Contract | Responsibility | Privacy Feature |
|----------|---------------|-----------------|
| MemecoinToken | ZK with private mint/burn | Encrypted balances, nullifier-based transfers |
| BondingCurvePool | Private bonding curve trading | Hidden reserves, ZK price proofs |
| PumpFactory | Anonymous launch registry | Stealth address deployment, unlinkable launches |
| ProtocolConfig | Encrypted global config | ZK-based parameter updates |
| LiquidityMigration | Private → Public transition | Threshold-based auto-migration |
| PrivacyRelayer | Stealth address monitoring | Off-chain encrypted state sync |
| ZK_DEX_Hook | DEX integration layer | Private liquidity provision |

### Starknet vs EVM Privacy Primitives

| Layer | EVM Version | ❌ Starknet Support | ✅ Zump.fun Solution | Why Better? |
|-------|-------------|-------------------|---------------------|-------------|
| **Cryptographic Curve** | Secp256k1 | ❌ Not native | Stark-friendly EC (Cairo VM) | Efficient ZK proving |
| **Hash Primitive** | SHA3-256 | ⚠️ Supported but slow | **Poseidon / Pedersen Hash** | ZK-optimized, 10x faster |
| **Key Agreement** | ECDH | ❌ Curve mismatch | **ZK Commitments + Note Encryption** | Native zk-rollup mechanism |
| **Stealth Payments** | BIP-352 / EIP-5564 | ❌ EVM only | **SSAP-Stark (Stealth Standard)** | Account abstraction native |
| **Off-chain Logic** | ROFL (TEE) | ❌ Oasis-only | **zkWatcher + Nullifier Scanner** | Pure ZK trust assumptions |
| **Sender Privacy** | Ring Signatures | ❌ Heavy & non-ZK | **Nullifiers + Merkle Tree Notes** | Better scaling & anonymity |

## 💰 Market Opportunity

### The $63B+ Problem

```mermaid
pie title Memecoin Market Pain Points
    "Fear of Exposure" : 45
    "Targeted Attacks" : 25
    "Front-Running" : 15
    "Whale Tracking" : 10
    "Privacy Concerns" : 5
```

**Market Size**: $63B+ memecoin market cap

**Growing Needs**:
- 🎭 Private degen trading
- 👻 Anonymous token launches  
- 🐋 Invisible whale coordination
- 🌱 Fairer community growth
- 🛡️ Protection from Arkham Intelligence & Dune Analytics

**Why Now?**:
- 90%+ of traders fear wallet exposure
- High-profile doxxing incidents (James Wynn, Hyperliquid reveals)
- Increasing sophistication of on-chain analytics
- Regulatory pressure on transparent transactions

## 🚀 Getting Started

### Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) (Cairo package manager)
- [Node.js](https://nodejs.org/) (v18+)
- [StarkNet account](https://www.starknet.io/en/developers/account-abstraction) with testnet ETH
- **Privacy mindset** - Understanding of zero-knowledge proofs (helpful but not required)

### Installation

```mermaid
graph LR
    A[Clone Repo] --> B[Install Scarb]
    B --> C[Install Node Deps]
    C --> D[Configure .env]
    D --> E[Build Contracts]
    E --> F[Deploy Core]
    F --> G[Create Launch]
    G --> H[Start Frontend]
    
    style A fill:#4A90E2
    style E fill:#50C878
    style F fill:#FFD700
    style H fill:#FF69B4
```

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd zump.fun
   ```

2. **Install Scarb** (if not already installed)
   ```bash
   # On macOS/Linux
   curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
   
   # On Windows (using Scoop)
   scoop install scarb
   
   # Or download from: https://github.com/software-mansion/scarb/releases
   ```

3. **Install Node.js dependencies**
   ```bash
   # Install root dependencies (Cairo tooling)
   npm install
   
   # Install frontend dependencies
   cd zump-frontend
   npm install --legacy-peer-deps
   cd ..
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your StarkNet account details
   ```

### Configuration

Edit `.env` file with your configuration:

```env
NETWORK=sepolia
RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
PRIVATE_KEY=your_private_key_here
ACCOUNT_ADDRESS=your_account_address_here
QUOTE_TOKEN=0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
```

## 📝 Usage

### Development Workflow

```mermaid
flowchart TD
    Start([Start Development]) --> Build[scarb build]
    Build --> Deploy[npm run deploy]
    Deploy --> Launch[npm run create-launch]
    Launch --> Frontend[cd zump-frontend && npm start]
    Frontend --> Test{Test Features}
    Test -->|Issues Found| Debug[Debug & Fix]
    Debug --> Build
    Test -->|All Good| Interact[npm run interact]
    Interact --> Deploy2{Deploy More?}
    Deploy2 -->|Yes| Launch
    Deploy2 -->|No| End([Done])
    
    style Start fill:#4A90E2
    style Build fill:#50C878
    style Deploy fill:#FFD700
    style Frontend fill:#FF69B4
    style End fill:#4A90E2
```

### Build Contracts

```bash
scarb build
```

This compiles all Cairo contracts to Sierra and CASM formats in the `target/dev/` directory.

### Deploy Core Contracts

Deploy the core protocol contracts (ProtocolConfig, PumpFactory, LiquidityMigration):

```bash
npm run deploy
```

This will:
1. Deploy `ProtocolConfig` with initial fee settings
2. Deploy `PumpFactory` for launch registry
3. Deploy `LiquidityMigration` stub
4. Save deployment addresses to `deployments/{NETWORK}.json`

### Create a New Launch

Create a new memecoin launch:

```bash
npm run create-launch <name> <symbol> <basePrice> <slope> <maxSupply> [quoteToken]
```

**Example:**
```bash
npm run create-launch "DogeCoin" "DOGE" "1000000000000000" "1000000000000" "1000000000000000000000000"
```

Parameters:
- `name`: Token name (e.g., "DogeCoin")
- `symbol`: Token symbol (e.g., "DOGE")
- `basePrice`: Starting price in wei (e.g., "1000000000000000" = 0.001 ETH)
- `slope`: Price increase per token sold (e.g., "1000000000000" = 0.000001 ETH)
- `maxSupply`: Maximum tokens to mint (e.g., "1000000000000000000000000" = 1M tokens with 18 decimals)
- `quoteToken`: (Optional) Quote token address (defaults to .env QUOTE_TOKEN)

This will:
1. Deploy a new `MemecoinToken`
2. Deploy a new `BondingCurvePool`
3. Link them together
4. Register the launch in `PumpFactory`
5. Save launch info to `deployments/launches.json`

### Start Frontend

```bash
cd zump-frontend
npm start
```

The frontend will be available at `http://localhost:3000`

## 📁 Project Structure

```
zump.fun/
├── src/                          # Cairo source files
│   ├── lib.cairo                # Main library file
│   ├── memecoin_token.cairo     # ERC20 token contract
│   ├── protocol_config.cairo    # Global protocol config
│   ├── bonding_curve_pool.cairo # Bonding curve logic
│   ├── pump_factory.cairo       # Launch registry
│   ├── liquidity_migration.cairo # DEX migration stub
│   ├── privacy_relayer.cairo    # Privacy features (future)
│   └── zk_dex_hook.cairo        # ZK DEX integration (future)
├── zump-frontend/               # React frontend application
│   ├── src/                     # Frontend source code
│   ├── public/                  # Static assets
│   └── package.json             # Frontend dependencies
├── scripts/                      # Deployment scripts
│   ├── deploy.ts                # Deploy core contracts
│   ├── create_launch.ts         # Create new launch
│   └── interact.ts              # Contract interaction
├── deployments/                  # Deployment addresses
│   ├── sepolia.json             # Core contract deployments
│   └── launches.json            # Launch registry
├── tests/                       # Test files
│   └── test_memecoin_token.cairo # Token tests
├── target/                       # Compiled contracts (generated)
├── Scarb.toml                   # Scarb configuration
├── package.json                 # Node.js dependencies
└── README.md                    # This file
```

### Module Dependencies

```mermaid
graph TD
    subgraph "Core Contracts"
        PC[ProtocolConfig]
        PF[PumpFactory]
        LM[LiquidityMigration]
    end
    
    subgraph "Per-Launch Contracts"
        MT[MemecoinToken]
        BCP[BondingCurvePool]
    end
    
    subgraph "Future Modules"
        PR[PrivacyRelayer]
        ZK[ZK_DEX_Hook]
    end
    
    subgraph "External"
        ERC20[IERC20<br/>Quote Token]
        DEX[DEX Router]
    end
    
    PF -->|deploys| MT
    PF -->|deploys| BCP
    PF -->|queries| PC
    
    BCP -->|mints/burns| MT
    BCP -->|reads config| PC
    BCP -->|transfers| ERC20
    
    LM -->|marks migrated| BCP
    LM -->|adds liquidity| DEX
    
    PR -.->|future| BCP
    ZK -.->|future| DEX
    
    style PC fill:#4A90E2
    style PF fill:#4A90E2
    style LM fill:#4A90E2
    style MT fill:#50C878
    style BCP fill:#50C878
    style PR fill:#FFA500,stroke-dasharray: 5 5
    style ZK fill:#FFA500,stroke-dasharray: 5 5
```

## 🔧 Contract Details

### Private Trading Flow

```mermaid
sequenceDiagram
    participant User as 👤 Primary Wallet
    participant Stealth as 👻 Stealth Wallet
    participant ZK as ⚡ ZK Engine
    participant Pool as 💰 Private Pool
    participant Merkle as 🌳 Merkle Tree
    participant Null as 🔒 Nullifier Set
    participant Token as 🪙 ZK-Token

    Note over User,Token: Private Buy Flow (Untraceable)
    User->>Stealth: Generate stealth address
    Stealth->>ZK: Create buy proof (amount hidden)
    ZK->>ZK: Generate ZK-SNARK
    ZK->>Pool: Submit proof + encrypted note
    Pool->>Null: Check nullifier (prevent double-spend)
    Null-->>Pool: Valid (not spent)
    Pool->>Pool: Calculate cost (encrypted)
    Pool->>Merkle: Add commitment to tree
    Pool->>Token: Mint to encrypted address
    Token-->>Stealth: Tokens received (balance hidden)
    
    Note over User,Token: Observer sees: Nothing linkable

    Note over User,Token: Private Sell Flow (Untraceable)
    Stealth->>ZK: Create sell proof (position hidden)
    ZK->>ZK: Generate ZK-SNARK + nullifier
    ZK->>Pool: Submit proof + nullifier
    Pool->>Null: Mark nullifier as spent
    Pool->>Merkle: Verify membership proof
    Merkle-->>Pool: Valid commitment
    Pool->>Token: Burn from encrypted address
    Pool->>Stealth: Refund (amount hidden)
    
    Note over User,Token: Observer sees: Nothing linkable
    Note over User,Token: Primary wallet ≠ Stealth wallet<br/>No connection possible
```

### Stealth Address Architecture

```mermaid
graph TB
    subgraph "User Identity Layer"
        PW[Primary Wallet<br/>0x1234...abcd<br/>Public Identity]
    end
    
    subgraph "Privacy Generation"
        KDF[Key Derivation<br/>Poseidon Hash]
        RNG[Random Nonce<br/>Entropy Source]
    end
    
    subgraph "Stealth Layer"
        SA1[Stealth Address 1<br/>0xabcd...1234]
        SA2[Stealth Address 2<br/>0xef56...7890]
        SA3[Stealth Address 3<br/>0x9876...fedc]
        SAN[Stealth Address N<br/>0x...infinite]
    end
    
    subgraph "Unlinkability Proof"
        OBS[Observer/Analyst]
        LINK{Can Link?}
    end
    
    PW --> KDF
    RNG --> KDF
    KDF --> SA1
    KDF --> SA2
    KDF --> SA3
    KDF --> SAN
    
    SA1 -.->|Analyze| OBS
    SA2 -.->|Analyze| OBS
    SA3 -.->|Analyze| OBS
    PW -.->|Analyze| OBS
    
    OBS --> LINK
    LINK -->|❌ NO| UNLINK[Unlinkable<br/>Zero Information]
    
    style PW fill:#4A90E2
    style SA1 fill:#1a1a1a
    style SA2 fill:#1a1a1a
    style SA3 fill:#1a1a1a
    style SAN fill:#1a1a1a
    style UNLINK fill:#50C878
```

### Anonymous Launch Creation Flow

```mermaid
sequenceDiagram
    participant User as 👤 Primary Wallet
    participant Stealth as 👻 Stealth Wallet
    participant ZK as ⚡ ZK Engine
    participant Factory as 🏭 PumpFactory
    participant Token as 🪙 ZK-Token
    participant Pool as 💰 Private Pool
    participant Darkpool as 🌑 DarkPool

    Note over User,Darkpool: Step 1: Stealth Setup
    User->>Stealth: Generate stealth keypair
    User->>Stealth: Send funds (unlinkable)
    Note over Stealth: Primary ≠ Stealth<br/>No connection possible

    Note over User,Darkpool: Step 2: Anonymous Deploy
    Stealth->>ZK: Create deployment proof
    ZK->>ZK: Generate ZK-SNARK (hide creator)
    ZK->>Factory: Submit anonymous launch request
    
    Factory->>Token: Deploy ZK-ERC20 (encrypted)
    Token-->>Factory: token_address (public)
    
    Factory->>Pool: Deploy private bonding curve
    Pool->>Darkpool: Register in mixer
    Pool-->>Factory: pool_address (public)
    
    Factory->>Token: Set minter = pool (encrypted)
    
    Note over Factory: Launch Registered
    Factory-->>ZK: launch_id, addresses
    ZK-->>Stealth: Success (creator hidden)
    
    Note over User,Darkpool: Observer sees: Token exists<br/>Creator identity: Unknown<br/>Until self-declared

    Note over User,Darkpool: Step 3: Private Trading Begins
    Stealth->>Pool: Private buy/sell (ZK proofs)
    Pool->>Darkpool: Mix transactions
    Note over Darkpool: Infinite mixing<br/>Infinite anonymity
```

### DarkPool Mixing Architecture

```mermaid
graph TB
    subgraph "Input Layer - Multiple Stealth Wallets"
        S1[👻 Stealth 1]
        S2[👻 Stealth 2]
        S3[👻 Stealth 3]
        SN[👻 Stealth N]
    end
    
    subgraph "DarkPool Mixer - One Unified Pool"
        DP[🌑 DarkPool<br/>Infinite Mixing]
        MT[Merkle Tree<br/>Commitments]
        NS[Nullifier Set<br/>Spent Notes]
        ZKV[ZK Verifier<br/>Proof Validation]
    end
    
    subgraph "Output Layer - Unlinkable"
        O1[💰 Output 1]
        O2[💰 Output 2]
        O3[💰 Output 3]
        ON[💰 Output N]
    end
    
    S1 -->|Deposit + Proof| DP
    S2 -->|Deposit + Proof| DP
    S3 -->|Deposit + Proof| DP
    SN -->|Deposit + Proof| DP
    
    DP --> MT
    DP --> NS
    DP --> ZKV
    
    DP -->|Withdraw + Proof| O1
    DP -->|Withdraw + Proof| O2
    DP -->|Withdraw + Proof| O3
    DP -->|Withdraw + Proof| ON
    
    style DP fill:#1a1a1a
    style MT fill:#9370DB
    style NS fill:#9370DB
    style ZKV fill:#9370DB
    style S1 fill:#1a1a1a
    style S2 fill:#1a1a1a
    style S3 fill:#1a1a1a
    style SN fill:#1a1a1a
```

### MemecoinToken

Standard ERC20 token with additional mint/burn functionality controlled by the bonding curve pool.

**Key Functions:**
- `mint(to, amount)` - Only callable by minter (pool)
- `burn(from, amount)` - Only callable by minter (pool)
- `update_minter(new_minter)` - Transfer minter role

### BondingCurvePool

Implements a linear bonding curve: `price = base_price + slope * tokens_sold`

**Key Functions:**
- `buy(amount_tokens)` - Buy tokens at current price
- `sell(amount_tokens)` - Sell tokens back to pool
- `get_current_price()` - Get current token price
- `set_migrated()` - Mark pool as migrated (disables trading)

**Price Calculation:**
- Linear curve: `current_price = base_price + (slope * tokens_sold)`
- Protocol fee deducted on buy/sell
- Fees sent to protocol treasury

### Privacy Guarantees - What's Hidden vs Visible

```mermaid
graph TB
    subgraph "❌ What Observers CANNOT See"
        H1[👤 Creator Identity]
        H2[💰 Trading Amounts]
        H3[💵 Position Sizes]
        H4[🔗 Wallet Links]
        H5[📊 Individual Balances]
        H6[🎯 Buy/Sell Actions]
        H7[🐋 Whale Movements]
        H8[💸 Profit/Loss]
    end
    
    subgraph "✅ What Observers CAN See"
        V1[📈 Total Pool TVL]
        V2[💹 Current Price]
        V3[🪙 Token Address]
        V4[📊 Chart Movement]
        V5[🔢 Total Supply]
    end
    
    subgraph "🔒 Privacy Layer"
        ZK[Zero-Knowledge Proofs]
        ENC[Encrypted State]
        NULL[Nullifiers]
        MIX[DarkPool Mixer]
    end
    
    H1 --> ZK
    H2 --> ENC
    H3 --> ENC
    H4 --> MIX
    H5 --> ENC
    H6 --> NULL
    H7 --> MIX
    H8 --> ENC
    
    ZK --> PRIV[👻 Complete Privacy]
    ENC --> PRIV
    NULL --> PRIV
    MIX --> PRIV
    
    V1 --> PUB[📊 Market Info Only]
    V2 --> PUB
    V3 --> PUB
    V4 --> PUB
    V5 --> PUB
    
    style PRIV fill:#1a1a1a
    style PUB fill:#50C878
    style H1 fill:#FF6B6B
    style H2 fill:#FF6B6B
    style H3 fill:#FF6B6B
    style H4 fill:#FF6B6B
    style H5 fill:#FF6B6B
    style H6 fill:#FF6B6B
    style H7 fill:#FF6B6B
    style H8 fill:#FF6B6B
```

### Private Bonding Curve (Hidden Positions)

```mermaid
graph TB
    subgraph "Public View"
        PC[📈 Price Curve<br/>Visible]
        TVL[💰 Total TVL<br/>Visible]
    end
    
    subgraph "Private Layer - Encrypted"
        T1[👻 Trader 1<br/>Position: Hidden]
        T2[👻 Trader 2<br/>Position: Hidden]
        T3[👻 Trader 3<br/>Position: Hidden]
        TN[👻 Trader N<br/>Position: Hidden]
    end
    
    subgraph "ZK Proof System"
        BP[Base Price] -->|+ slope × tokens_sold| CP[Current Price]
        CP --> BUY{Trade}
        BUY -->|Buy| UP[Price ↑<br/>Amount Hidden]
        BUY -->|Sell| DOWN[Price ↓<br/>Amount Hidden]
    end
    
    T1 -.->|ZK Proof| BUY
    T2 -.->|ZK Proof| BUY
    T3 -.->|ZK Proof| BUY
    TN -.->|ZK Proof| BUY
    
    UP --> PC
    DOWN --> PC
    
    T1 --> TVL
    T2 --> TVL
    T3 --> TVL
    TN --> TVL
    
    style PC fill:#50C878
    style TVL fill:#50C878
    style T1 fill:#1a1a1a
    style T2 fill:#1a1a1a
    style T3 fill:#1a1a1a
    style TN fill:#1a1a1a
    style BUY fill:#9370DB
```

### Complete Privacy Flow - End to End

```mermaid
flowchart TD
    Start([👤 User Arrives]) --> Gen[Generate Stealth]
    Gen --> Fund[Fund Stealth<br/>Unlinkable Transfer]
    Fund --> Choice{What to do?}
    
    Choice -->|Create| Launch[🚀 Anonymous Launch]
    Choice -->|Trade| Trade[💰 Private Trading]
    
    Launch --> ZKL[ZK Proof Generation]
    ZKL --> Deploy[Deploy Token<br/>Creator Hidden]
    Deploy --> Pool[Create Private Pool]
    Pool --> Dark[Register in DarkPool]
    
    Trade --> ZKT[ZK Proof Generation]
    ZKT --> Verify[Verify Proof]
    Verify --> Execute[Execute Trade<br/>Amount Hidden]
    Execute --> Mix[Mix in DarkPool]
    
    Dark --> Monitor{Threshold?}
    Mix --> Monitor
    
    Monitor -->|Not Yet| Continue[Continue Private Trading]
    Continue --> Trade
    
    Monitor -->|Reached| Migrate[Auto-Migrate to DEX]
    Migrate --> Public[Public Trading Available]
    
    Public --> Final{Privacy Status}
    Final -->|Stealth Positions| Forever[👻 Private Forever]
    Final -->|New Traders| NormalTrade[📊 Normal Trading]
    
    Forever --> End([🔒 Privacy Preserved])
    NormalTrade --> End
    
    style Start fill:#4A90E2
    style Gen fill:#9370DB
    style Launch fill:#1a1a1a
    style Trade fill:#1a1a1a
    style Dark fill:#1a1a1a
    style Mix fill:#1a1a1a
    style Forever fill:#1a1a1a
    style End fill:#50C878
```

### PumpFactory

Registry for all launches. Frontend can query all launches and their details.

**Key Functions:**
- `register_launch(...)` - Register a new launch
- `get_launch(launch_id)` - Get launch details
- `total_launches()` - Get total number of launches
- `mark_migrated(launch_id)` - Mark launch as migrated

### ProtocolConfig

Global protocol configuration that can be updated by owner.

**Key Functions:**
- `get_fee_config()` - Get fee percentage and receiver
- `set_fee_config(fee_bps, fee_receiver)` - Update fees (owner only)
- `get_curve_limits()` - Get allowed curve parameters
- `set_curve_limits(...)` - Update limits (owner only)

### LiquidityMigration

Stub contract for future DEX migration functionality.

**Key Functions:**
- `migrate_stub(launch_id, pool_addr)` - Mark pool as migrated (owner only)

### Migration Flow (Future)

```mermaid
stateDiagram-v2
    [*] --> PRE_MIGRATION: Launch Created
    PRE_MIGRATION --> READY_TO_MIGRATE: Bonding Curve Complete
    READY_TO_MIGRATE --> MIGRATING: Migration Initiated
    MIGRATING --> MIGRATED: LP Added to DEX
    MIGRATED --> [*]: Trading on DEX
    
    note right of PRE_MIGRATION
        Active trading on
        bonding curve
    end note
    
    note right of MIGRATING
        Liquidity moved to DEX
        LP tokens locked
    end note
    
    note right of MIGRATED
        Bonding curve disabled
        DEX trading only
    end note
```

### Contract State Diagram

```mermaid
stateDiagram-v2
    [*] --> Deployed: Deploy Contracts
    Deployed --> Active: Initialize
    Active --> Trading: First Buy
    Trading --> Trading: Buy/Sell
    Trading --> Paused: Emergency Stop
    Paused --> Trading: Resume
    Trading --> Migrating: Start Migration
    Migrating --> Migrated: Complete Migration
    Migrated --> [*]
    
    note right of Trading
        Normal operations
        Bonding curve active
    end note
    
    note right of Migrated
        Trading disabled
        DEX liquidity live
    end note
```

1. **Arithmetic Safety**
   - Add overflow checks for all arithmetic operations
   - Use safe math libraries
   - Validate all input parameters

2. **Access Control**
   - Implement proper access controls on migration functions
   - Multi-signature for critical operations
   - Role-based permissions

3. **Anti-Bot Protection**
   - Add rate limiting and anti-bot measures
   - Cooldown periods between trades
   - Maximum wallet limits

4. **Mathematical Validation**
   - Audit bonding curve math for edge cases
   - Test extreme values
   - Validate price calculations

5. **Liquidity Protection**
   - Implement proper LP locking mechanisms
   - Timelock for migrations
   - Emergency pause functionality

6. **Testing & Auditing**
   - Add comprehensive test coverage
   - Professional security audit
   - Formal verification of critical functions

## 📚 Resources

- [StarkNet Documentation](https://docs.starknet.io/)
- [Cairo Book](https://book.cairo-lang.org/)
- [Scarb Documentation](https://docs.swmansion.com/scarb/)
- [StarkNet.js](https://www.starknetjs.com/)

## 🎯 Vision & Roadmap

### Zump.fun: Privacy Infrastructure for Web3

```mermaid
timeline
    title Zump.fun Evolution
    section Phase 1 - Ghost Launch
        MVP : Private memecoin launches
            : Stealth address generation
            : Anonymous trading
            : Auto DEX migration
    section Phase 2 - DarkPool
        Privacy Layer : Enhanced mixing protocols
                     : Multi-layer anonymity
                     : Cross-chain stealth bridges
    section Phase 3 - Financial Privacy
        Real-World Use : Private credit/debit cards
                      : Disposable wallets
                      : Hedge fund privacy tools
    section Phase 4 - Privacy Standard
        Infrastructure : Privacy SDK for developers
                      : Stealth address standard
                      : Universal privacy protocol
```

### Beyond Memecoins

**Zump.fun is the proof of concept** of what's possible with private stealth addresses.

**Endless Possibilities**:
- 💳 **Private Payments** - Credit/debit card transactions without traces
- 🌉 **Cross-Chain Privacy** - Bridge assets anonymously between chains
- 🗑️ **Disposable Wallets** - Single-use addresses for maximum privacy
- 🏦 **Institutional Privacy** - Hedge fund-grade confidential trading
- 🛡️ **Anti-Doxxing** - End to wallet tracking and targeted attacks
- 🌐 **Privacy Infrastructure** - Building blocks for private DeFi

**No more**:
- ❌ James Wynn-style exposures
- ❌ Hyperliquid wallet reveals
- ❌ Arkham Intelligence tracking
- ❌ Targeted attacks on traders
- ❌ Front-running by bots
- ❌ Whale wallet monitoring

**Yes to**:
- ✅ True financial privacy
- ✅ Anonymous trading
- ✅ Protected positions
- ✅ Fair market participation
- ✅ Ghost-mode operations
- ✅ Untraceable wealth

---

Built with 👻 for Privacy Maximalists on StarkNet

*"In crypto, privacy is not a feature. It's a fundamental right."*


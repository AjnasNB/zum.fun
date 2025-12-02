use starknet::ContractAddress;
use starknet::get_caller_address;

// ============================================================================
// External Interfaces
// ============================================================================

#[starknet::interface]
trait IERC20<TContractState> {
    fn transfer_from(
        ref self: TContractState,
        from: ContractAddress,
        to: ContractAddress,
        amount: u256
    ) -> bool;
    fn transfer(
        ref self: TContractState,
        to: ContractAddress,
        amount: u256
    ) -> bool;
    fn mint(
        ref self: TContractState,
        to: ContractAddress,
        amount: u256
    );
    fn burn(
        ref self: TContractState,
        from: ContractAddress,
        amount: u256
    );
}

#[starknet::interface]
trait IProtocolConfig<TContractState> {
    fn get_fee_config(self: @TContractState) -> (u16, ContractAddress);
}

#[starknet::interface]
trait IPumpFactory<TContractState> {
    fn check_migration_threshold(ref self: TContractState, launch_id: u256) -> bool;
}

// ============================================================================
// ZK Proof Structures (imported from zk_proof_verifier)
// ============================================================================

/// Proof point on G1 curve
#[derive(Copy, Drop, Serde, starknet::Store, PartialEq)]
struct G1ProofPoint {
    x: felt252,
    y: felt252,
}

/// Proof point on G2 curve
#[derive(Copy, Drop, Serde, starknet::Store, PartialEq)]
struct G2ProofPoint {
    x0: felt252,
    x1: felt252,
    y0: felt252,
    y1: felt252,
}

/// ZK Proof structure
#[derive(Copy, Drop, Serde, starknet::Store, PartialEq)]
struct ZKProof {
    public_input_hash: felt252,
    merkle_root: felt252,
    nullifier_hash: felt252,
    proof_a: G1ProofPoint,
    proof_b: G2ProofPoint,
    proof_c: G1ProofPoint,
    proof_type: u8,
    timestamp: u64,
}

// ============================================================================
// ZKProofVerifier Interface
// ============================================================================

#[starknet::interface]
trait IZKProofVerifier<TContractState> {
    fn verify_proof(ref self: TContractState, proof: ZKProof) -> bool;
    fn is_proof_verified(self: @TContractState, proof_hash: felt252) -> bool;
}

// ============================================================================
// NullifierRegistry Interface
// ============================================================================

#[starknet::interface]
trait INullifierRegistry<TContractState> {
    fn spend_nullifier(ref self: TContractState, nullifier: felt252, pool: ContractAddress);
    fn is_spent(self: @TContractState, nullifier: felt252) -> bool;
}

// ============================================================================
// Pool State Structure
// ============================================================================

#[derive(Copy, Drop, Serde)]
struct PoolState {
    token: ContractAddress,
    quote_token: ContractAddress,
    tokens_sold: u256,
    reserve_balance: u256,
    migrated: bool,
}

// ============================================================================
// BondingCurvePool Contract
// ============================================================================

#[starknet::contract]
#[feature("deprecated-starknet-consts")]
mod BondingCurvePool {
    use super::{
        ContractAddress, get_caller_address,
        IERC20Dispatcher, IERC20DispatcherTrait, 
        IProtocolConfigDispatcher, IProtocolConfigDispatcherTrait,
        IZKProofVerifierDispatcher, IZKProofVerifierDispatcherTrait,
        INullifierRegistryDispatcher, INullifierRegistryDispatcherTrait,
        IPumpFactoryDispatcher, IPumpFactoryDispatcherTrait,
        ZKProof, PoolState
    };
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess, Map
    };

    // Proof types
    const PROOF_TYPE_BUY: u8 = 1;
    const PROOF_TYPE_SELL: u8 = 2;

    #[storage]
    struct Storage {
        token: ContractAddress,
        quote_token: ContractAddress,
        creator: ContractAddress,
        protocol_config: ContractAddress,
        base_price: u256,
        slope: u256,
        max_supply: u256,
        tokens_sold: u256,
        reserve_balance: u256,
        migrated: bool,
        // Privacy components
        zk_proof_verifier: ContractAddress,
        nullifier_registry: ContractAddress,
        private_trades_enabled: bool,
        shielded_commitments: Map<felt252, bool>,
        // Factory integration for automatic migration
        factory: ContractAddress,
        launch_id: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Buy: Buy,
        Sell: Sell,
        Migrated: Migrated,
        PrivateBuy: PrivateBuy,
        PrivateSell: PrivateSell,
    }

    #[derive(Drop, starknet::Event)]
    struct Buy {
        #[key]
        buyer: ContractAddress,
        amount_tokens: u256,
        cost_quote: u256,
        fee_quote: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Sell {
        #[key]
        seller: ContractAddress,
        amount_tokens: u256,
        refund_quote: u256,
        fee_quote: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Migrated {
        #[key]
        pool: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PrivateBuy {
        #[key]
        commitment: felt252,
        amount_tokens: u256,
        price: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PrivateSell {
        #[key]
        commitment: felt252,
        amount_tokens: u256,
        price: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        token: ContractAddress,
        quote_token: ContractAddress,
        creator: ContractAddress,
        protocol_config: ContractAddress,
        base_price: u256,
        slope: u256,
        max_supply: u256
    ) {
        self.token.write(token);
        self.quote_token.write(quote_token);
        self.creator.write(creator);
        self.protocol_config.write(protocol_config);
        self.base_price.write(base_price);
        self.slope.write(slope);
        self.max_supply.write(max_supply);
        self.tokens_sold.write(0);
        self.reserve_balance.write(0);
        self.migrated.write(false);
        self.private_trades_enabled.write(false);
    }

    // =========================================================================
    // Internal Helper Functions
    // =========================================================================

    /// Check if pool is migrated and revert if so
    fn assert_not_migrated(self: @ContractState) {
        let migrated = self.migrated.read();
        assert(!migrated, 'ALREADY_MIGRATED');
    }

    /// Calculate current price using bonding curve formula: price = base_price + (slope × tokens_sold)
    fn calculate_current_price(self: @ContractState) -> u256 {
        let base = self.base_price.read();
        let slope = self.slope.read();
        let sold = self.tokens_sold.read();
        base + (slope * sold)
    }

    /// Calculate protocol fee
    fn calculate_fee(self: @ContractState, amount: u256) -> (u256, ContractAddress) {
        let proto_addr = self.protocol_config.read();
        let proto = IProtocolConfigDispatcher { contract_address: proto_addr };
        let (fee_bps, fee_receiver) = proto.get_fee_config();
        let fee = (amount * fee_bps.into()) / 10000;
        (fee, fee_receiver)
    }

    /// Check migration threshold after buy operations
    /// Requirements: 8.4 - Automatic DEX migration when threshold reached
    fn check_and_trigger_migration(ref self: ContractState) {
        let factory_addr = self.factory.read();
        if factory_addr != starknet::contract_address_const::<0>() {
            let launch_id = self.launch_id.read();
            let mut factory = IPumpFactoryDispatcher { contract_address: factory_addr };
            // This will trigger migration if threshold is reached
            factory.check_migration_threshold(launch_id);
        }
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// Get current price using bonding curve formula
    #[external(v0)]
    fn get_current_price(self: @ContractState) -> u256 {
        calculate_current_price(self)
    }

    /// Get pool state
    #[external(v0)]
    fn get_state(self: @ContractState) -> PoolState {
        PoolState {
            token: self.token.read(),
            quote_token: self.quote_token.read(),
            tokens_sold: self.tokens_sold.read(),
            reserve_balance: self.reserve_balance.read(),
            migrated: self.migrated.read(),
        }
    }

    #[external(v0)]
    fn token(self: @ContractState) -> ContractAddress {
        self.token.read()
    }

    #[external(v0)]
    fn quote_token(self: @ContractState) -> ContractAddress {
        self.quote_token.read()
    }

    #[external(v0)]
    fn creator(self: @ContractState) -> ContractAddress {
        self.creator.read()
    }

    #[external(v0)]
    fn base_price(self: @ContractState) -> u256 {
        self.base_price.read()
    }

    #[external(v0)]
    fn slope(self: @ContractState) -> u256 {
        self.slope.read()
    }

    #[external(v0)]
    fn max_supply(self: @ContractState) -> u256 {
        self.max_supply.read()
    }

    #[external(v0)]
    fn tokens_sold(self: @ContractState) -> u256 {
        self.tokens_sold.read()
    }

    #[external(v0)]
    fn reserve_balance(self: @ContractState) -> u256 {
        self.reserve_balance.read()
    }

    #[external(v0)]
    fn migrated(self: @ContractState) -> bool {
        self.migrated.read()
    }

    #[external(v0)]
    fn is_private_trades_enabled(self: @ContractState) -> bool {
        self.private_trades_enabled.read()
    }

    #[external(v0)]
    fn get_zk_proof_verifier(self: @ContractState) -> ContractAddress {
        self.zk_proof_verifier.read()
    }

    #[external(v0)]
    fn get_nullifier_registry(self: @ContractState) -> ContractAddress {
        self.nullifier_registry.read()
    }

    #[external(v0)]
    fn get_factory(self: @ContractState) -> ContractAddress {
        self.factory.read()
    }

    #[external(v0)]
    fn get_launch_id(self: @ContractState) -> u256 {
        self.launch_id.read()
    }

    // =========================================================================
    // Configuration Functions
    // =========================================================================

    /// Set ZK proof verifier address
    #[external(v0)]
    fn set_zk_proof_verifier(ref self: ContractState, verifier: ContractAddress) {
        // TODO: Add owner check in production
        self.zk_proof_verifier.write(verifier);
    }

    /// Set nullifier registry address
    #[external(v0)]
    fn set_nullifier_registry(ref self: ContractState, registry: ContractAddress) {
        // TODO: Add owner check in production
        self.nullifier_registry.write(registry);
    }

    /// Enable/disable private trades
    #[external(v0)]
    fn set_private_trades_enabled(ref self: ContractState, enabled: bool) {
        // TODO: Add owner check in production
        self.private_trades_enabled.write(enabled);
    }

    /// Set factory address and launch ID for automatic migration
    /// Requirements: 8.4 - Automatic DEX migration when threshold reached
    #[external(v0)]
    fn set_factory(ref self: ContractState, factory: ContractAddress, launch_id: u256) {
        // TODO: Add owner check in production
        self.factory.write(factory);
        self.launch_id.write(launch_id);
    }

    // =========================================================================
    // Public Trading Functions
    // =========================================================================

    /// Public buy - buyer identity is visible
    #[external(v0)]
    fn buy(ref self: ContractState, amount_tokens: u256) {
        // Check migration state
        assert_not_migrated(@self);
        
        let caller = get_caller_address();
        let max_supply = self.max_supply.read();
        let sold = self.tokens_sold.read();
        assert(sold + amount_tokens <= max_supply, 'MAX_SUPPLY_REACHED');
        
        // Calculate price using bonding curve formula
        let price = calculate_current_price(@self);
        let total_cost = price * amount_tokens;

        // Calculate protocol fee
        let (fee, fee_receiver) = calculate_fee(@self, total_cost);
        let net_cost = total_cost - fee;

        let quote_addr = self.quote_token.read();
        let mut quote = IERC20Dispatcher { contract_address: quote_addr };
        let pool_addr = starknet::get_contract_address();

        // Transfer quote from buyer to pool
        quote.transfer_from(caller, pool_addr, net_cost);

        // Transfer fee to protocol
        quote.transfer_from(caller, fee_receiver, fee);

        // Mint tokens to buyer
        let token_addr = self.token.read();
        let mut token = IERC20Dispatcher { contract_address: token_addr };
        token.mint(caller, amount_tokens);

        // Update state
        self.tokens_sold.write(sold + amount_tokens);
        let reserve = self.reserve_balance.read();
        self.reserve_balance.write(reserve + net_cost);

        self.emit(Buy { 
            buyer: caller, 
            amount_tokens, 
            cost_quote: total_cost, 
            fee_quote: fee 
        });

        // Check migration threshold after buy (Requirements: 8.4)
        check_and_trigger_migration(ref self);
    }

    /// Public sell - seller identity is visible
    #[external(v0)]
    fn sell(ref self: ContractState, amount_tokens: u256) {
        // Check migration state
        assert_not_migrated(@self);
        
        let caller = get_caller_address();
        let sold = self.tokens_sold.read();
        assert(sold >= amount_tokens, 'NOT_ENOUGH_SOLD');
        
        // Calculate price using bonding curve formula
        let price = calculate_current_price(@self);
        let gross_refund = price * amount_tokens;

        // Calculate protocol fee
        let (fee, fee_receiver) = calculate_fee(@self, gross_refund);
        let net_refund = gross_refund - fee;

        let reserve = self.reserve_balance.read();
        assert(reserve >= net_refund, 'INSUFFICIENT_RESERVE');

        // Burn tokens from seller
        let token_addr = self.token.read();
        let mut token = IERC20Dispatcher { contract_address: token_addr };
        token.burn(caller, amount_tokens);

        let quote_addr = self.quote_token.read();
        let mut quote = IERC20Dispatcher { contract_address: quote_addr };

        // Send refund
        quote.transfer(caller, net_refund);

        // Send fee
        quote.transfer(fee_receiver, fee);

        // Update state
        self.tokens_sold.write(sold - amount_tokens);
        self.reserve_balance.write(reserve - net_refund);

        self.emit(Sell { 
            seller: caller, 
            amount_tokens, 
            refund_quote: net_refund, 
            fee_quote: fee 
        });
    }

    // =========================================================================
    // Private Trading Functions (ZK-enabled)
    // =========================================================================

    /// Private buy - buyer identity is hidden via ZK proof
    /// Requirements: 6.1, 6.4
    #[external(v0)]
    fn private_buy(
        ref self: ContractState,
        amount_tokens: u256,
        proof: ZKProof,
        commitment: felt252
    ) {
        // Check migration state
        assert_not_migrated(@self);
        
        // Check if private trades are enabled
        assert(self.private_trades_enabled.read(), 'PRIVATE_TRADES_DISABLED');
        
        // Verify ZK proof
        let verifier_addr = self.zk_proof_verifier.read();
        assert(verifier_addr != starknet::contract_address_const::<0>(), 'VERIFIER_NOT_SET');
        
        let mut verifier = IZKProofVerifierDispatcher { contract_address: verifier_addr };
        
        // Verify proof type is BUY
        assert(proof.proof_type == PROOF_TYPE_BUY, 'INVALID_PROOF_TYPE');
        
        // Verify the ZK proof
        let is_valid = verifier.verify_proof(proof);
        assert(is_valid, 'INVALID_PROOF');
        
        // Check supply limits
        let max_supply = self.max_supply.read();
        let sold = self.tokens_sold.read();
        assert(sold + amount_tokens <= max_supply, 'MAX_SUPPLY_REACHED');
        
        // Calculate price using bonding curve formula
        let price = calculate_current_price(@self);
        let total_cost = price * amount_tokens;

        // Calculate protocol fee
        let (fee, fee_receiver) = calculate_fee(@self, total_cost);
        let net_cost = total_cost - fee;

        // For private buy, the caller (relayer) transfers funds on behalf of the user
        let caller = get_caller_address();
        let quote_addr = self.quote_token.read();
        let mut quote = IERC20Dispatcher { contract_address: quote_addr };
        let pool_addr = starknet::get_contract_address();

        // Transfer quote from caller (relayer) to pool
        quote.transfer_from(caller, pool_addr, net_cost);

        // Transfer fee to protocol
        quote.transfer_from(caller, fee_receiver, fee);

        // Mint tokens to caller (relayer will forward to stealth address)
        let token_addr = self.token.read();
        let mut token = IERC20Dispatcher { contract_address: token_addr };
        token.mint(caller, amount_tokens);

        // Store commitment for tracking
        self.shielded_commitments.write(commitment, true);

        // Update state
        self.tokens_sold.write(sold + amount_tokens);
        let reserve = self.reserve_balance.read();
        self.reserve_balance.write(reserve + net_cost);

        // Emit privacy-preserving event with commitment instead of address
        self.emit(PrivateBuy { 
            commitment, 
            amount_tokens, 
            price 
        });

        // Check migration threshold after private buy (Requirements: 8.4)
        check_and_trigger_migration(ref self);
    }

    /// Private sell - seller identity is hidden via nullifier
    /// Requirements: 6.2, 6.4
    #[external(v0)]
    fn private_sell(
        ref self: ContractState,
        amount_tokens: u256,
        proof: ZKProof,
        nullifier: felt252
    ) {
        // Check migration state
        assert_not_migrated(@self);
        
        // Check if private trades are enabled
        assert(self.private_trades_enabled.read(), 'PRIVATE_TRADES_DISABLED');
        
        // Verify ZK proof
        let verifier_addr = self.zk_proof_verifier.read();
        assert(verifier_addr != starknet::contract_address_const::<0>(), 'VERIFIER_NOT_SET');
        
        let mut verifier = IZKProofVerifierDispatcher { contract_address: verifier_addr };
        
        // Verify proof type is SELL
        assert(proof.proof_type == PROOF_TYPE_SELL, 'INVALID_PROOF_TYPE');
        
        // Verify the ZK proof
        let is_valid = verifier.verify_proof(proof);
        assert(is_valid, 'INVALID_PROOF');
        
        // Check and spend nullifier (prevents double-spending)
        let registry_addr = self.nullifier_registry.read();
        assert(registry_addr != starknet::contract_address_const::<0>(), 'REGISTRY_NOT_SET');
        
        let mut registry = INullifierRegistryDispatcher { contract_address: registry_addr };
        
        // Check if nullifier is already spent
        let is_spent = registry.is_spent(nullifier);
        assert(!is_spent, 'NULLIFIER_ALREADY_SPENT');
        
        // Spend the nullifier
        let pool_addr = starknet::get_contract_address();
        registry.spend_nullifier(nullifier, pool_addr);
        
        // Check sold amount
        let sold = self.tokens_sold.read();
        assert(sold >= amount_tokens, 'NOT_ENOUGH_SOLD');
        
        // Calculate price using bonding curve formula
        let price = calculate_current_price(@self);
        let gross_refund = price * amount_tokens;

        // Calculate protocol fee
        let (fee, fee_receiver) = calculate_fee(@self, gross_refund);
        let net_refund = gross_refund - fee;

        let reserve = self.reserve_balance.read();
        assert(reserve >= net_refund, 'INSUFFICIENT_RESERVE');

        // Burn tokens from caller (relayer holds tokens on behalf of user)
        let caller = get_caller_address();
        let token_addr = self.token.read();
        let mut token = IERC20Dispatcher { contract_address: token_addr };
        token.burn(caller, amount_tokens);

        let quote_addr = self.quote_token.read();
        let mut quote = IERC20Dispatcher { contract_address: quote_addr };

        // Send refund to caller (relayer will forward to stealth address)
        quote.transfer(caller, net_refund);

        // Send fee to protocol
        quote.transfer(fee_receiver, fee);

        // Update state
        self.tokens_sold.write(sold - amount_tokens);
        self.reserve_balance.write(reserve - net_refund);

        // Emit privacy-preserving event with nullifier hash as commitment
        self.emit(PrivateSell { 
            commitment: nullifier, 
            amount_tokens, 
            price 
        });
    }

    // =========================================================================
    // Migration Functions
    // =========================================================================

    /// Mark pool as migrated (callable only by authorized migration contract)
    #[external(v0)]
    fn set_migrated(ref self: ContractState) {
        let _caller = get_caller_address();
        // TODO: In production, verify caller is authorized migration contract
        self.migrated.write(true);
        self.emit(Migrated { pool: starknet::get_contract_address() });
    }

    /// Check if a commitment exists (for verification)
    #[external(v0)]
    fn is_commitment_valid(self: @ContractState, commitment: felt252) -> bool {
        self.shielded_commitments.read(commitment)
    }
}

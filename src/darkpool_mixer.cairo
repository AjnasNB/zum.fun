use starknet::ContractAddress;

// Commitment structure for Merkle tree
#[derive(Copy, Drop, Serde, starknet::Store)]
struct Commitment {
    hash: felt252,
    timestamp: u64,
    amount: u256,
}

// Deposit note (encrypted)
#[derive(Copy, Drop, Serde)]
struct DepositNote {
    commitment: felt252,
    nullifier: felt252,
    amount: u256,
    token: ContractAddress,
}

#[starknet::interface]
trait IERC20<TContractState> {
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256
    ) -> bool;
    fn transfer(
        ref self: TContractState,
        recipient: ContractAddress,
        amount: u256
    ) -> bool;
}

// Interface for CommitmentTree contract
#[starknet::interface]
trait ICommitmentTree<TContractState> {
    fn insert_commitment(ref self: TContractState, commitment: felt252) -> u256;
    fn verify_proof(
        self: @TContractState,
        leaf: felt252,
        leaf_index: u256,
        path: Span<felt252>,
        root: felt252
    ) -> bool;
    fn get_current_root(self: @TContractState) -> felt252;
    fn is_known_root(self: @TContractState, root: felt252) -> bool;
}

// Interface for NullifierRegistry contract
#[starknet::interface]
trait INullifierRegistry<TContractState> {
    fn spend_nullifier(ref self: TContractState, nullifier: felt252, pool: ContractAddress);
    fn is_spent(self: @TContractState, nullifier: felt252) -> bool;
}


#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
mod DarkPoolMixer {
    use super::{
        ContractAddress,
        IERC20Dispatcher, IERC20DispatcherTrait, 
        ICommitmentTreeDispatcher, ICommitmentTreeDispatcherTrait,
        INullifierRegistryDispatcher, INullifierRegistryDispatcherTrait
    };
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use starknet::get_block_timestamp;
    use core::array::ArrayTrait;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        // External contract references
        commitment_tree: ContractAddress,
        nullifier_registry: ContractAddress,
        // Fee receiver address
        fee_receiver: ContractAddress,
        // Supported tokens
        supported_tokens: LegacyMap<ContractAddress, bool>,
        // Pool reserves per token
        pool_reserves: LegacyMap<ContractAddress, u256>,
        // Minimum deposit amount
        min_deposit: u256,
        // Maximum deposit amount
        max_deposit: u256,
        // Mixing fee (basis points)
        fee_bps: u256,
        // Total deposits count
        total_deposits: u256,
        // Total withdrawals count
        total_withdrawals: u256,
        // Commitment to token mapping (for withdrawal validation)
        commitment_tokens: LegacyMap<felt252, ContractAddress>,
        // Commitment to amount mapping (for withdrawal validation)
        commitment_amounts: LegacyMap<felt252, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Deposit: Deposit,
        Withdrawal: Withdrawal,
        TokenAdded: TokenAdded,
        TokenRemoved: TokenRemoved,
        FeeUpdated: FeeUpdated,
        LimitsUpdated: LimitsUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposit {
        #[key]
        commitment: felt252,
        token: ContractAddress,
        amount: u256,
        leaf_index: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawal {
        #[key]
        nullifier: felt252,
        #[key]
        recipient: ContractAddress,
        token: ContractAddress,
        amount: u256,
        fee: u256,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenAdded {
        #[key]
        token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenRemoved {
        #[key]
        token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct FeeUpdated {
        old_fee_bps: u256,
        new_fee_bps: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LimitsUpdated {
        min_deposit: u256,
        max_deposit: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        commitment_tree: ContractAddress,
        nullifier_registry: ContractAddress,
        fee_receiver: ContractAddress
    ) {
        self.owner.write(owner);
        self.commitment_tree.write(commitment_tree);
        self.nullifier_registry.write(nullifier_registry);
        self.fee_receiver.write(fee_receiver);
        self.min_deposit.write(1000000000000000); // 0.001 ETH (10^15 wei)
        self.max_deposit.write(100000000000000000000); // 100 ETH (10^20 wei)
        self.fee_bps.write(30); // 0.3%
        self.total_deposits.write(0);
        self.total_withdrawals.write(0);
    }

    fn only_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'ONLY_OWNER');
    }


    // ============ DEPOSIT FUNCTIONALITY (Task 10.1) ============
    
    /// Deposit funds into DarkPool (creates commitment)
    /// Requirements: 7.1, 7.5
    /// - Creates commitment and adds to Merkle tree via CommitmentTree contract
    /// - Validates supported token
    /// - Validates amount within min/max range
    #[external(v0)]
    fn deposit(
        ref self: ContractState,
        token: ContractAddress,
        amount: u256,
        commitment: felt252
    ) {
        let caller = get_caller_address();
        let contract = get_contract_address();
        let timestamp = get_block_timestamp();
        
        // Validate token is supported (Requirement 7.5)
        assert(self.supported_tokens.read(token), 'TOKEN_NOT_SUPPORTED');
        
        // Validate amount within range (Requirement 7.4)
        assert(amount >= self.min_deposit.read(), 'AMOUNT_TOO_LOW');
        assert(amount <= self.max_deposit.read(), 'AMOUNT_TOO_HIGH');
        
        // Validate commitment is not zero
        assert(commitment != 0, 'INVALID_COMMITMENT');

        // Transfer tokens to mixer
        let token_dispatcher = IERC20Dispatcher { contract_address: token };
        let success = token_dispatcher.transfer_from(caller, contract, amount);
        assert(success, 'TRANSFER_FAILED');

        // Add commitment to Merkle tree via CommitmentTree contract (Requirement 7.1)
        let commitment_tree_addr = self.commitment_tree.read();
        let commitment_tree = ICommitmentTreeDispatcher { contract_address: commitment_tree_addr };
        let leaf_index = commitment_tree.insert_commitment(commitment);

        // Store commitment metadata for withdrawal validation
        self.commitment_tokens.write(commitment, token);
        self.commitment_amounts.write(commitment, amount);

        // Update pool reserves
        let current_reserve = self.pool_reserves.read(token);
        self.pool_reserves.write(token, current_reserve + amount);

        // Update deposit counter
        let total = self.total_deposits.read();
        self.total_deposits.write(total + 1);

        self.emit(Deposit {
            commitment,
            token,
            amount,
            leaf_index,
            timestamp,
        });
    }

    // ============ WITHDRAWAL FUNCTIONALITY (Task 10.2) ============
    
    /// Withdraw funds from DarkPool (spends nullifier)
    /// Requirements: 7.2
    /// - Verifies Merkle proof via CommitmentTree contract
    /// - Spends nullifier via NullifierRegistry contract
    /// - Deducts fee and transfers remaining amount
    #[external(v0)]
    fn withdraw(
        ref self: ContractState,
        token: ContractAddress,
        amount: u256,
        nullifier: felt252,
        recipient: ContractAddress,
        commitment: felt252,
        leaf_index: u256,
        merkle_proof: Span<felt252>,
        merkle_root: felt252
    ) {
        let contract = get_contract_address();
        let timestamp = get_block_timestamp();
        
        // Validate nullifier not already spent via NullifierRegistry
        let nullifier_registry_addr = self.nullifier_registry.read();
        let nullifier_registry = INullifierRegistryDispatcher { contract_address: nullifier_registry_addr };
        assert(!nullifier_registry.is_spent(nullifier), 'NULLIFIER_ALREADY_SPENT');
        
        // Verify Merkle proof via CommitmentTree contract (Requirement 7.2)
        let commitment_tree_addr = self.commitment_tree.read();
        let commitment_tree = ICommitmentTreeDispatcher { contract_address: commitment_tree_addr };
        
        // Verify the root is known (current or historical)
        assert(commitment_tree.is_known_root(merkle_root), 'INVALID_MERKLE_ROOT');
        
        // Verify the Merkle proof
        let valid_proof = commitment_tree.verify_proof(commitment, leaf_index, merkle_proof, merkle_root);
        assert(valid_proof, 'INVALID_MERKLE_PROOF');

        // Spend nullifier via NullifierRegistry (Requirement 7.2)
        nullifier_registry.spend_nullifier(nullifier, contract);

        // Calculate fee (Requirement 7.3 - Task 10.3)
        let fee = calculate_fee(amount, self.fee_bps.read());
        let amount_after_fee = amount - fee;

        // Update reserves
        let current_reserve = self.pool_reserves.read(token);
        assert(current_reserve >= amount, 'INSUFFICIENT_LIQUIDITY');
        self.pool_reserves.write(token, current_reserve - amount);

        // Transfer fee to fee receiver
        let token_dispatcher = IERC20Dispatcher { contract_address: token };
        if fee > 0 {
            let fee_receiver = self.fee_receiver.read();
            let fee_success = token_dispatcher.transfer(fee_receiver, fee);
            assert(fee_success, 'FEE_TRANSFER_FAILED');
        }

        // Transfer remaining amount to recipient
        let success = token_dispatcher.transfer(recipient, amount_after_fee);
        assert(success, 'TRANSFER_FAILED');

        // Update withdrawal counter
        let total = self.total_withdrawals.read();
        self.total_withdrawals.write(total + 1);

        self.emit(Withdrawal {
            nullifier,
            recipient,
            token,
            amount: amount_after_fee,
            fee,
            timestamp,
        });
    }


    // ============ FEE CALCULATION (Task 10.3) ============
    
    /// Calculate mixing fee based on fee_bps
    /// Requirements: 7.3
    /// Formula: fee = (amount * fee_bps) / 10000
    fn calculate_fee(amount: u256, fee_bps: u256) -> u256 {
        (amount * fee_bps) / 10000
    }

    /// Get the fee amount for a given withdrawal amount
    #[external(v0)]
    fn get_fee_amount(self: @ContractState, amount: u256) -> u256 {
        calculate_fee(amount, self.fee_bps.read())
    }

    /// Get the amount after fee deduction
    #[external(v0)]
    fn get_amount_after_fee(self: @ContractState, amount: u256) -> u256 {
        let fee = calculate_fee(amount, self.fee_bps.read());
        amount - fee
    }

    // ============ AMOUNT VALIDATION (Task 10.5) ============
    
    /// Validate deposit amount is within allowed range
    /// Requirements: 7.4
    #[external(v0)]
    fn validate_deposit_amount(self: @ContractState, amount: u256) -> bool {
        let min = self.min_deposit.read();
        let max = self.max_deposit.read();
        amount >= min && amount <= max
    }

    /// Get minimum deposit amount
    #[external(v0)]
    fn get_min_deposit(self: @ContractState) -> u256 {
        self.min_deposit.read()
    }

    /// Get maximum deposit amount
    #[external(v0)]
    fn get_max_deposit(self: @ContractState) -> u256 {
        self.max_deposit.read()
    }

    // ============ ADMIN FUNCTIONS ============

    /// Add supported token
    #[external(v0)]
    fn add_supported_token(ref self: ContractState, token: ContractAddress) {
        only_owner(@self);
        self.supported_tokens.write(token, true);
        self.emit(TokenAdded { token });
    }

    /// Remove supported token
    #[external(v0)]
    fn remove_supported_token(ref self: ContractState, token: ContractAddress) {
        only_owner(@self);
        self.supported_tokens.write(token, false);
        self.emit(TokenRemoved { token });
    }

    /// Set mixing fee (basis points)
    #[external(v0)]
    fn set_fee_bps(ref self: ContractState, new_fee_bps: u256) {
        only_owner(@self);
        assert(new_fee_bps <= 1000, 'FEE_TOO_HIGH'); // Max 10%
        let old_fee_bps = self.fee_bps.read();
        self.fee_bps.write(new_fee_bps);
        self.emit(FeeUpdated { old_fee_bps, new_fee_bps });
    }

    /// Set deposit limits
    #[external(v0)]
    fn set_deposit_limits(ref self: ContractState, min_deposit: u256, max_deposit: u256) {
        only_owner(@self);
        assert(min_deposit < max_deposit, 'INVALID_LIMITS');
        self.min_deposit.write(min_deposit);
        self.max_deposit.write(max_deposit);
        self.emit(LimitsUpdated { min_deposit, max_deposit });
    }

    /// Set fee receiver address
    #[external(v0)]
    fn set_fee_receiver(ref self: ContractState, fee_receiver: ContractAddress) {
        only_owner(@self);
        self.fee_receiver.write(fee_receiver);
    }

    /// Update commitment tree address
    #[external(v0)]
    fn set_commitment_tree(ref self: ContractState, commitment_tree: ContractAddress) {
        only_owner(@self);
        self.commitment_tree.write(commitment_tree);
    }

    /// Update nullifier registry address
    #[external(v0)]
    fn set_nullifier_registry(ref self: ContractState, nullifier_registry: ContractAddress) {
        only_owner(@self);
        self.nullifier_registry.write(nullifier_registry);
    }


    // ============ VIEW FUNCTIONS ============

    /// Check if token is supported
    #[external(v0)]
    fn is_token_supported(self: @ContractState, token: ContractAddress) -> bool {
        self.supported_tokens.read(token)
    }

    /// Get pool reserves for a token
    #[external(v0)]
    fn get_pool_reserves(self: @ContractState, token: ContractAddress) -> u256 {
        self.pool_reserves.read(token)
    }

    /// Get current Merkle root from CommitmentTree
    #[external(v0)]
    fn get_merkle_root(self: @ContractState) -> felt252 {
        let commitment_tree_addr = self.commitment_tree.read();
        let commitment_tree = ICommitmentTreeDispatcher { contract_address: commitment_tree_addr };
        commitment_tree.get_current_root()
    }

    /// Check if nullifier is spent via NullifierRegistry
    #[external(v0)]
    fn is_nullifier_spent(self: @ContractState, nullifier: felt252) -> bool {
        let nullifier_registry_addr = self.nullifier_registry.read();
        let nullifier_registry = INullifierRegistryDispatcher { contract_address: nullifier_registry_addr };
        nullifier_registry.is_spent(nullifier)
    }

    /// Get current fee in basis points
    #[external(v0)]
    fn get_fee_bps(self: @ContractState) -> u256 {
        self.fee_bps.read()
    }

    /// Get fee receiver address
    #[external(v0)]
    fn get_fee_receiver(self: @ContractState) -> ContractAddress {
        self.fee_receiver.read()
    }

    /// Get commitment tree address
    #[external(v0)]
    fn get_commitment_tree(self: @ContractState) -> ContractAddress {
        self.commitment_tree.read()
    }

    /// Get nullifier registry address
    #[external(v0)]
    fn get_nullifier_registry(self: @ContractState) -> ContractAddress {
        self.nullifier_registry.read()
    }

    /// Get total deposits count
    #[external(v0)]
    fn get_total_deposits(self: @ContractState) -> u256 {
        self.total_deposits.read()
    }

    /// Get total withdrawals count
    #[external(v0)]
    fn get_total_withdrawals(self: @ContractState) -> u256 {
        self.total_withdrawals.read()
    }

    /// Get owner address
    #[external(v0)]
    fn get_owner(self: @ContractState) -> ContractAddress {
        self.owner.read()
    }

    /// Get commitment token (for validation)
    #[external(v0)]
    fn get_commitment_token(self: @ContractState, commitment: felt252) -> ContractAddress {
        self.commitment_tokens.read(commitment)
    }

    /// Get commitment amount (for validation)
    #[external(v0)]
    fn get_commitment_amount(self: @ContractState, commitment: felt252) -> u256 {
        self.commitment_amounts.read(commitment)
    }
}

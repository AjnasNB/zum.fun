use starknet::ContractAddress;
use core::poseidon::poseidon_hash_span;

// Nullifier entry with metadata
#[derive(Copy, Drop, Serde, starknet::Store)]
struct NullifierEntry {
    nullifier: felt252,
    spent_at: u64,
    pool: ContractAddress,
    spent_by: ContractAddress, // Encrypted/hidden in production
}

#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
mod NullifierRegistry {
    use super::{ContractAddress, NullifierEntry, poseidon_hash_span};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use core::array::ArrayTrait;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        // Nullifier -> Is spent
        spent_nullifiers: LegacyMap<felt252, bool>,
        // Nullifier -> Entry details
        nullifier_entries: LegacyMap<felt252, NullifierEntry>,
        // Pool -> Is authorized
        authorized_pools: LegacyMap<ContractAddress, bool>,
        // Relayer -> Is authorized
        authorized_relayers: LegacyMap<ContractAddress, bool>,
        // Total nullifiers spent
        total_spent: u256,
        // Nullifier spent per pool
        pool_nullifier_count: LegacyMap<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        NullifierSpent: NullifierSpent,
        PoolAuthorized: PoolAuthorized,
        RelayerAuthorized: RelayerAuthorized,
        DoubleSpendAttempt: DoubleSpendAttempt,
    }

    #[derive(Drop, starknet::Event)]
    struct NullifierSpent {
        #[key]
        nullifier: felt252,
        #[key]
        pool: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PoolAuthorized {
        #[key]
        pool: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct RelayerAuthorized {
        #[key]
        relayer: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct DoubleSpendAttempt {
        #[key]
        nullifier: felt252,
        #[key]
        attacker: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress
    ) {
        self.owner.write(owner);
        self.total_spent.write(0);
    }

    fn only_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'ONLY_OWNER');
    }

    fn only_authorized(self: @ContractState) {
        let caller = get_caller_address();
        let is_pool = self.authorized_pools.read(caller);
        let is_relayer = self.authorized_relayers.read(caller);
        assert(is_pool || is_relayer, 'NOT_AUTHORIZED');
    }

    // Mark nullifier as spent (only authorized pools/relayers)
    #[external(v0)]
    fn spend_nullifier(
        ref self: ContractState,
        nullifier: felt252,
        pool: ContractAddress
    ) {
        only_authorized(@self);
        let caller = get_caller_address();
        
        // Check if already spent (prevent double-spending)
        let already_spent = self.spent_nullifiers.read(nullifier);
        if already_spent {
            self.emit(DoubleSpendAttempt {
                nullifier,
                attacker: caller,
            });
            assert(false, 'NULLIFIER_ALREADY_SPENT');
        }

        // Mark as spent
        let timestamp = get_block_timestamp();
        self.spent_nullifiers.write(nullifier, true);
        
        // Store entry details
        let entry = NullifierEntry {
            nullifier,
            spent_at: timestamp,
            pool,
            spent_by: caller,
        };
        self.nullifier_entries.write(nullifier, entry);

        // Update counters
        let total = self.total_spent.read();
        self.total_spent.write(total + 1);
        
        let pool_count = self.pool_nullifier_count.read(pool);
        self.pool_nullifier_count.write(pool, pool_count + 1);

        self.emit(NullifierSpent {
            nullifier,
            pool,
            timestamp,
        });
    }

    // Batch spend nullifiers (optimized for multiple transactions)
    #[external(v0)]
    fn batch_spend_nullifiers(
        ref self: ContractState,
        nullifiers: Span<felt252>,
        pool: ContractAddress
    ) {
        only_authorized(@self);
        let caller = get_caller_address();
        
        let mut i: u32 = 0;
        let len = nullifiers.len();
        
        loop {
            if i >= len {
                break;
            }
            
            let nullifier = *nullifiers.at(i);
            
            // Check if already spent (prevent double-spending)
            let already_spent = self.spent_nullifiers.read(nullifier);
            if already_spent {
                self.emit(DoubleSpendAttempt {
                    nullifier,
                    attacker: caller,
                });
                assert(false, 'NULLIFIER_ALREADY_SPENT');
            }

            // Mark as spent
            let timestamp = get_block_timestamp();
            self.spent_nullifiers.write(nullifier, true);
            
            // Store entry details
            let entry = NullifierEntry {
                nullifier,
                spent_at: timestamp,
                pool,
                spent_by: caller,
            };
            self.nullifier_entries.write(nullifier, entry);

            // Update counters
            let total = self.total_spent.read();
            self.total_spent.write(total + 1);
            
            let pool_count = self.pool_nullifier_count.read(pool);
            self.pool_nullifier_count.write(pool, pool_count + 1);

            self.emit(NullifierSpent {
                nullifier,
                pool,
                timestamp,
            });
            
            i += 1;
        };
    }

    // Check if nullifier is spent
    #[external(v0)]
    fn is_spent(
        self: @ContractState,
        nullifier: felt252
    ) -> bool {
        self.spent_nullifiers.read(nullifier)
    }

    // Check multiple nullifiers at once
    #[external(v0)]
    fn are_spent(
        self: @ContractState,
        nullifiers: Span<felt252>
    ) -> Span<bool> {
        let mut results = ArrayTrait::new();
        let mut i: u32 = 0;
        let len = nullifiers.len();
        
        loop {
            if i >= len {
                break;
            }
            
            let nullifier = *nullifiers.at(i);
            let spent = self.spent_nullifiers.read(nullifier);
            results.append(spent);
            
            i += 1;
        };
        
        results.span()
    }

    // Get nullifier entry details
    #[external(v0)]
    fn get_nullifier_entry(
        self: @ContractState,
        nullifier: felt252
    ) -> NullifierEntry {
        self.nullifier_entries.read(nullifier)
    }

    // Authorize pool to spend nullifiers
    #[external(v0)]
    fn authorize_pool(
        ref self: ContractState,
        pool: ContractAddress
    ) {
        only_owner(@self);
        self.authorized_pools.write(pool, true);
        
        self.emit(PoolAuthorized { pool });
    }

    // Authorize relayer to spend nullifiers
    #[external(v0)]
    fn authorize_relayer(
        ref self: ContractState,
        relayer: ContractAddress
    ) {
        only_owner(@self);
        self.authorized_relayers.write(relayer, true);
        
        self.emit(RelayerAuthorized { relayer });
    }

    // Revoke pool authorization
    #[external(v0)]
    fn revoke_pool(
        ref self: ContractState,
        pool: ContractAddress
    ) {
        only_owner(@self);
        self.authorized_pools.write(pool, false);
    }

    // Revoke relayer authorization
    #[external(v0)]
    fn revoke_relayer(
        ref self: ContractState,
        relayer: ContractAddress
    ) {
        only_owner(@self);
        self.authorized_relayers.write(relayer, false);
    }

    // Check if pool is authorized
    #[external(v0)]
    fn is_pool_authorized(
        self: @ContractState,
        pool: ContractAddress
    ) -> bool {
        self.authorized_pools.read(pool)
    }

    // Check if relayer is authorized
    #[external(v0)]
    fn is_relayer_authorized(
        self: @ContractState,
        relayer: ContractAddress
    ) -> bool {
        self.authorized_relayers.read(relayer)
    }

    // Get total spent nullifiers
    #[external(v0)]
    fn get_total_spent(self: @ContractState) -> u256 {
        self.total_spent.read()
    }

    // Get nullifiers spent for specific pool
    #[external(v0)]
    fn get_pool_nullifier_count(
        self: @ContractState,
        pool: ContractAddress
    ) -> u256 {
        self.pool_nullifier_count.read(pool)
    }

    // Generate nullifier hash (helper function)
    #[external(v0)]
    fn generate_nullifier(
        self: @ContractState,
        secret: felt252,
        commitment: felt252
    ) -> felt252 {
        let mut data = ArrayTrait::new();
        data.append(secret);
        data.append(commitment);
        poseidon_hash_span(data.span())
    }
}


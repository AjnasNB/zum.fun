use starknet::ContractAddress;
use starknet::get_caller_address;

// ============================================================================
// Launch Info Structure
// ============================================================================

/// Launch information stored in the factory
/// Note: creator field stores stealth address to preserve anonymity
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct LaunchInfo {
    pub token: ContractAddress,
    pub pool: ContractAddress,
    pub quote_token: ContractAddress,
    pub creator: ContractAddress,  // Stealth address - identity hidden
    pub name: felt252,
    pub symbol: felt252,
    pub base_price: u256,
    pub slope: u256,
    pub max_supply: u256,
    pub created_at: u64,
    pub migrated: bool,
    pub migration_threshold: u256,
}

/// Public launch info - excludes sensitive creator data
#[derive(Copy, Drop, Serde)]
pub struct PublicLaunchInfo {
    pub token: ContractAddress,
    pub pool: ContractAddress,
    pub quote_token: ContractAddress,
    pub name: felt252,
    pub symbol: felt252,
    pub base_price: u256,
    pub slope: u256,
    pub max_supply: u256,
    pub created_at: u64,
    pub migrated: bool,
}

// ============================================================================
// External Interfaces
// ============================================================================

#[starknet::interface]
pub trait IStealthAddressGenerator<TContractState> {
    fn is_valid_stealth(self: @TContractState, address: ContractAddress) -> bool;
}

#[starknet::interface]
pub trait IBondingCurvePool<TContractState> {
    fn set_migrated(ref self: TContractState);
    fn reserve_balance(self: @TContractState) -> u256;
}

#[starknet::interface]
pub trait IPumpFactory<TContractState> {
    /// Create a new anonymous token launch
    fn create_launch(
        ref self: TContractState,
        name: felt252,
        symbol: felt252,
        base_price: u256,
        slope: u256,
        max_supply: u256,
        stealth_creator: ContractAddress,
        migration_threshold: u256
    ) -> (ContractAddress, ContractAddress);
    
    /// Register an existing launch (for PoC - off-chain deployment)
    fn register_launch(
        ref self: TContractState,
        token: ContractAddress,
        pool: ContractAddress,
        name: felt252,
        symbol: felt252,
        base_price: u256,
        slope: u256,
        max_supply: u256
    ) -> u256;
    
    /// Register an anonymous launch with stealth creator
    fn register_anonymous_launch(
        ref self: TContractState,
        token: ContractAddress,
        pool: ContractAddress,
        quote_token: ContractAddress,
        name: felt252,
        symbol: felt252,
        base_price: u256,
        slope: u256,
        max_supply: u256,
        stealth_creator: ContractAddress,
        migration_threshold: u256
    ) -> u256;
    
    /// Get launch info (returns public data only)
    fn get_launch(self: @TContractState, launch_id: u256) -> PublicLaunchInfo;
    
    /// Get full launch info (internal use only)
    fn get_launch_full(self: @TContractState, launch_id: u256) -> LaunchInfo;
    
    /// Get total number of launches
    fn total_launches(self: @TContractState) -> u256;
    
    /// Mark a launch as migrated
    fn mark_migrated(ref self: TContractState, launch_id: u256);
    
    /// Check if migration threshold is reached and trigger migration
    fn check_migration_threshold(ref self: TContractState, launch_id: u256) -> bool;
    
    /// Get owner address
    fn owner(self: @TContractState) -> ContractAddress;
    
    /// Get stealth address generator
    fn stealth_generator(self: @TContractState) -> ContractAddress;
    
    /// Get liquidity migration contract
    fn liquidity_migration(self: @TContractState) -> ContractAddress;
    
    /// Set stealth address generator
    fn set_stealth_generator(ref self: TContractState, generator: ContractAddress);
    
    /// Set liquidity migration contract
    fn set_liquidity_migration(ref self: TContractState, migration: ContractAddress);
    
    /// Set quote token for new launches
    fn set_quote_token(ref self: TContractState, quote_token: ContractAddress);
    
    /// Set protocol config
    fn set_protocol_config(ref self: TContractState, config: ContractAddress);
}

// ============================================================================
// PumpFactory Contract
// ============================================================================

#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
pub mod PumpFactory {
    use super::{
        ContractAddress, get_caller_address, 
        LaunchInfo, PublicLaunchInfo,
        IStealthAddressGeneratorDispatcher, IStealthAddressGeneratorDispatcherTrait,
        IBondingCurvePoolDispatcher, IBondingCurvePoolDispatcherTrait,
        IPumpFactory
    };
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::get_block_timestamp;

    #[storage]
    struct Storage {
        /// All launches indexed by ID
        launches: LegacyMap<u256, LaunchInfo>,
        /// Total number of launches
        launch_count: u256,
        /// Contract owner
        owner: ContractAddress,
        /// Stealth address generator contract
        stealth_generator: ContractAddress,
        /// Liquidity migration contract
        liquidity_migration: ContractAddress,
        /// Default quote token for new launches
        quote_token: ContractAddress,
        /// Protocol config contract
        protocol_config: ContractAddress,
        /// Token address -> Launch ID mapping
        token_to_launch: LegacyMap<ContractAddress, u256>,
        /// Pool address -> Launch ID mapping
        pool_to_launch: LegacyMap<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        LaunchCreated: LaunchCreated,
        LaunchRegistered: LaunchRegistered,
        LaunchMigrated: LaunchMigrated,
        MigrationThresholdReached: MigrationThresholdReached,
    }

    /// Event emitted when a new launch is created
    /// Note: creator field is stealth address to preserve anonymity
    #[derive(Drop, starknet::Event)]
    pub struct LaunchCreated {
        #[key]
        pub launch_id: u256,
        pub token: ContractAddress,
        pub pool: ContractAddress,
        // Note: We emit stealth address, not real creator identity
        pub stealth_creator: ContractAddress,
        pub migration_threshold: u256,
    }

    /// Event emitted when a launch is registered (legacy)
    #[derive(Drop, starknet::Event)]
    pub struct LaunchRegistered {
        #[key]
        pub launch_id: u256,
        pub token: ContractAddress,
        pub pool: ContractAddress,
        pub creator: ContractAddress,
    }

    /// Event emitted when a launch is migrated to DEX
    #[derive(Drop, starknet::Event)]
    pub struct LaunchMigrated {
        #[key]
        pub launch_id: u256,
    }

    /// Event emitted when migration threshold is reached
    #[derive(Drop, starknet::Event)]
    pub struct MigrationThresholdReached {
        #[key]
        pub launch_id: u256,
        pub pool: ContractAddress,
        pub reserve_balance: u256,
        pub threshold: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.launch_count.write(0);
    }

    /// Assert caller is owner
    fn assert_only_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'NOT_AUTHORIZED');
    }

    #[abi(embed_v0)]
    impl PumpFactoryImpl of IPumpFactory<ContractState> {
        /// Create a new anonymous token launch
        /// Requirements: 8.1, 8.2
        /// 
        /// This function creates a new token launch with a stealth creator address.
        /// The stealth address hides the real creator identity.
        /// 
        /// Note: In production, this would deploy actual MemecoinToken and BondingCurvePool
        /// contracts. For PoC, we use register_anonymous_launch after off-chain deployment.
        fn create_launch(
            ref self: ContractState,
            name: felt252,
            symbol: felt252,
            base_price: u256,
            slope: u256,
            max_supply: u256,
            stealth_creator: ContractAddress,
            migration_threshold: u256
        ) -> (ContractAddress, ContractAddress) {
            // Validate stealth creator is a valid stealth address
            let stealth_gen_addr = self.stealth_generator.read();
            if stealth_gen_addr != starknet::contract_address_const::<0>() {
                let stealth_gen = IStealthAddressGeneratorDispatcher { 
                    contract_address: stealth_gen_addr 
                };
                let is_valid = stealth_gen.is_valid_stealth(stealth_creator);
                assert(is_valid, 'INVALID_STEALTH_ADDRESS');
            }
            
            // In production: Deploy MemecoinToken and BondingCurvePool contracts
            // For PoC: Return zero addresses - use register_anonymous_launch after off-chain deployment
            let zero_addr = starknet::contract_address_const::<0>();
            
            // Note: Actual deployment would look like:
            // let token = deploy_memecoin_token(name, symbol, pool_address);
            // let pool = deploy_bonding_curve_pool(token, quote_token, stealth_creator, ...);
            
            (zero_addr, zero_addr)
        }

        /// Register an existing launch (legacy - for backward compatibility)
        fn register_launch(
            ref self: ContractState,
            token: ContractAddress,
            pool: ContractAddress,
            name: felt252,
            symbol: felt252,
            base_price: u256,
            slope: u256,
            max_supply: u256
        ) -> u256 {
            let creator = get_caller_address();
            let id = self.launch_count.read();
            let timestamp = get_block_timestamp();
            let quote_token = self.quote_token.read();
            
            let info = LaunchInfo {
                token,
                pool,
                quote_token,
                creator,
                name,
                symbol,
                base_price,
                slope,
                max_supply,
                created_at: timestamp,
                migrated: false,
                migration_threshold: 0, // No threshold for legacy launches
            };
            
            self.launches.write(id, info);
            self.token_to_launch.write(token, id);
            self.pool_to_launch.write(pool, id);
            self.launch_count.write(id + 1);
            
            self.emit(LaunchRegistered { launch_id: id, token, pool, creator });
            id
        }

        /// Register an anonymous launch with stealth creator
        /// Requirements: 8.1, 8.2
        /// 
        /// This is the main function for creating anonymous launches.
        /// The stealth_creator address hides the real creator identity.
        fn register_anonymous_launch(
            ref self: ContractState,
            token: ContractAddress,
            pool: ContractAddress,
            quote_token: ContractAddress,
            name: felt252,
            symbol: felt252,
            base_price: u256,
            slope: u256,
            max_supply: u256,
            stealth_creator: ContractAddress,
            migration_threshold: u256
        ) -> u256 {
            // Validate stealth creator is a valid stealth address (if generator is set)
            let stealth_gen_addr = self.stealth_generator.read();
            if stealth_gen_addr != starknet::contract_address_const::<0>() {
                let stealth_gen = IStealthAddressGeneratorDispatcher { 
                    contract_address: stealth_gen_addr 
                };
                let is_valid = stealth_gen.is_valid_stealth(stealth_creator);
                assert(is_valid, 'INVALID_STEALTH_ADDRESS');
            }
            
            let id = self.launch_count.read();
            let timestamp = get_block_timestamp();
            
            let info = LaunchInfo {
                token,
                pool,
                quote_token,
                creator: stealth_creator, // Store stealth address, not real identity
                name,
                symbol,
                base_price,
                slope,
                max_supply,
                created_at: timestamp,
                migrated: false,
                migration_threshold,
            };
            
            self.launches.write(id, info);
            self.token_to_launch.write(token, id);
            self.pool_to_launch.write(pool, id);
            self.launch_count.write(id + 1);
            
            self.emit(LaunchCreated { 
                launch_id: id, 
                token, 
                pool, 
                stealth_creator,
                migration_threshold,
            });
            
            id
        }

        /// Get launch info - returns PUBLIC data only
        /// Requirements: 8.3
        /// 
        /// This function returns only public information about a launch.
        /// The creator identity (stealth address) is NOT exposed.
        fn get_launch(self: @ContractState, launch_id: u256) -> PublicLaunchInfo {
            let info = self.launches.read(launch_id);
            
            // Return only public data - creator identity is hidden
            PublicLaunchInfo {
                token: info.token,
                pool: info.pool,
                quote_token: info.quote_token,
                name: info.name,
                symbol: info.symbol,
                base_price: info.base_price,
                slope: info.slope,
                max_supply: info.max_supply,
                created_at: info.created_at,
                migrated: info.migrated,
            }
        }

        /// Get full launch info (internal use - includes stealth creator)
        /// Note: This should be restricted in production
        fn get_launch_full(self: @ContractState, launch_id: u256) -> LaunchInfo {
            self.launches.read(launch_id)
        }

        /// Get total number of launches
        fn total_launches(self: @ContractState) -> u256 {
            self.launch_count.read()
        }

        /// Mark a launch as migrated
        /// Called by LiquidityMigration contract
        fn mark_migrated(ref self: ContractState, launch_id: u256) {
            let _caller = get_caller_address();
            // TODO: In production, restrict to LiquidityMigration contract only
            
            let info = self.launches.read(launch_id);
            let updated_info = LaunchInfo {
                token: info.token,
                pool: info.pool,
                quote_token: info.quote_token,
                creator: info.creator,
                name: info.name,
                symbol: info.symbol,
                base_price: info.base_price,
                slope: info.slope,
                max_supply: info.max_supply,
                created_at: info.created_at,
                migrated: true,
                migration_threshold: info.migration_threshold,
            };
            
            self.launches.write(launch_id, updated_info);
            self.emit(LaunchMigrated { launch_id });
        }

        /// Check if migration threshold is reached and trigger migration
        /// Requirements: 8.4
        /// 
        /// This function checks if the pool's reserve balance has reached
        /// the migration threshold. If so, it triggers automatic DEX migration.
        fn check_migration_threshold(ref self: ContractState, launch_id: u256) -> bool {
            let info = self.launches.read(launch_id);
            
            // Skip if already migrated or no threshold set
            if info.migrated {
                return false;
            }
            if info.migration_threshold == 0 {
                return false;
            }
            
            // Check pool reserve balance
            let pool = IBondingCurvePoolDispatcher { contract_address: info.pool };
            let reserve_balance = pool.reserve_balance();
            
            if reserve_balance >= info.migration_threshold {
                // Emit threshold reached event
                self.emit(MigrationThresholdReached {
                    launch_id,
                    pool: info.pool,
                    reserve_balance,
                    threshold: info.migration_threshold,
                });
                
                // Trigger migration via LiquidityMigration contract
                let migration_addr = self.liquidity_migration.read();
                if migration_addr != starknet::contract_address_const::<0>() {
                    // In production: Call migration contract to execute migration
                    // For PoC: Just mark as migrated
                    pool.set_migrated();
                    
                    // Update launch info
                    let updated_info = LaunchInfo {
                        token: info.token,
                        pool: info.pool,
                        quote_token: info.quote_token,
                        creator: info.creator,
                        name: info.name,
                        symbol: info.symbol,
                        base_price: info.base_price,
                        slope: info.slope,
                        max_supply: info.max_supply,
                        created_at: info.created_at,
                        migrated: true,
                        migration_threshold: info.migration_threshold,
                    };
                    self.launches.write(launch_id, updated_info);
                    
                    self.emit(LaunchMigrated { launch_id });
                }
                
                return true;
            }
            
            false
        }

        /// Get owner address
        fn owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        /// Get stealth address generator
        fn stealth_generator(self: @ContractState) -> ContractAddress {
            self.stealth_generator.read()
        }

        /// Get liquidity migration contract
        fn liquidity_migration(self: @ContractState) -> ContractAddress {
            self.liquidity_migration.read()
        }

        /// Set stealth address generator (owner only)
        fn set_stealth_generator(ref self: ContractState, generator: ContractAddress) {
            assert_only_owner(@self);
            self.stealth_generator.write(generator);
        }

        /// Set liquidity migration contract (owner only)
        fn set_liquidity_migration(ref self: ContractState, migration: ContractAddress) {
            assert_only_owner(@self);
            self.liquidity_migration.write(migration);
        }

        /// Set quote token for new launches (owner only)
        fn set_quote_token(ref self: ContractState, quote_token: ContractAddress) {
            assert_only_owner(@self);
            self.quote_token.write(quote_token);
        }

        /// Set protocol config (owner only)
        fn set_protocol_config(ref self: ContractState, config: ContractAddress) {
            assert_only_owner(@self);
            self.protocol_config.write(config);
        }
    }
}

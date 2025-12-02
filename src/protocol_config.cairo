use starknet::ContractAddress;

/// Fee configuration structure
#[derive(Drop, Copy, Serde)]
pub struct FeeConfig {
    pub fee_bps: u16,
    pub fee_receiver: ContractAddress,
}

/// Curve limits configuration structure
#[derive(Drop, Copy, Serde)]
pub struct CurveLimits {
    pub min_base_price: u256,
    pub max_base_price: u256,
    pub min_slope: u256,
    pub max_slope: u256,
    pub min_supply: u256,
    pub max_supply: u256,
}

#[starknet::interface]
pub trait IProtocolConfig<TContractState> {
    /// Get the current fee configuration
    fn get_fee_config(self: @TContractState) -> FeeConfig;
    
    /// Set fee configuration (owner only)
    fn set_fee_config(ref self: TContractState, fee_bps: u16, fee_receiver: ContractAddress);
    
    /// Get the current curve limits
    fn get_curve_limits(self: @TContractState) -> CurveLimits;
    
    /// Set curve limits (owner only)
    fn set_curve_limits(
        ref self: TContractState,
        min_base_price: u256,
        max_base_price: u256,
        min_slope: u256,
        max_slope: u256,
        min_supply: u256,
        max_supply: u256
    );
    
    /// Get the contract owner
    fn get_owner(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod ProtocolConfig {
    use super::{ContractAddress, FeeConfig, CurveLimits, IProtocolConfig};
    use starknet::get_caller_address;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    /// Error constants
    mod Errors {
        pub const NOT_AUTHORIZED: felt252 = 'NOT_AUTHORIZED';
    }

    #[storage]
    struct Storage {
        owner: ContractAddress,
        fee_bps: u16,
        fee_receiver: ContractAddress,
        min_base_price: u256,
        max_base_price: u256,
        min_slope: u256,
        max_slope: u256,
        min_supply: u256,
        max_supply: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        FeeConfigUpdated: FeeConfigUpdated,
        CurveLimitsUpdated: CurveLimitsUpdated,
        OwnershipTransferred: OwnershipTransferred,
    }

    #[derive(Drop, starknet::Event)]
    struct FeeConfigUpdated {
        fee_bps: u16,
        fee_receiver: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CurveLimitsUpdated {
        min_base_price: u256,
        max_base_price: u256,
        min_slope: u256,
        max_slope: u256,
        min_supply: u256,
        max_supply: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct OwnershipTransferred {
        previous_owner: ContractAddress,
        new_owner: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        fee_bps: u16,
        fee_receiver: ContractAddress,
        min_base_price: u256,
        max_base_price: u256,
        min_slope: u256,
        max_slope: u256,
        min_supply: u256,
        max_supply: u256
    ) {
        self.owner.write(owner);
        self.fee_bps.write(fee_bps);
        self.fee_receiver.write(fee_receiver);
        self.min_base_price.write(min_base_price);
        self.max_base_price.write(max_base_price);
        self.min_slope.write(min_slope);
        self.max_slope.write(max_slope);
        self.min_supply.write(min_supply);
        self.max_supply.write(max_supply);
    }

    /// Internal function to check if caller is owner
    /// Panics with NOT_AUTHORIZED if caller is not the owner
    fn assert_only_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, Errors::NOT_AUTHORIZED);
    }

    #[abi(embed_v0)]
    impl ProtocolConfigImpl of IProtocolConfig<ContractState> {
        /// Returns the current fee configuration
        /// Requirements: 9.1
        fn get_fee_config(self: @ContractState) -> FeeConfig {
            FeeConfig {
                fee_bps: self.fee_bps.read(),
                fee_receiver: self.fee_receiver.read(),
            }
        }

        /// Sets the fee configuration (owner only)
        /// Requirements: 9.2, 9.3
        fn set_fee_config(
            ref self: ContractState,
            fee_bps: u16,
            fee_receiver: ContractAddress
        ) {
            // Only owner can update fee configuration
            assert_only_owner(@self);
            
            self.fee_bps.write(fee_bps);
            self.fee_receiver.write(fee_receiver);
            
            self.emit(FeeConfigUpdated { fee_bps, fee_receiver });
        }

        /// Returns the current curve limits
        /// Requirements: 9.4
        fn get_curve_limits(self: @ContractState) -> CurveLimits {
            CurveLimits {
                min_base_price: self.min_base_price.read(),
                max_base_price: self.max_base_price.read(),
                min_slope: self.min_slope.read(),
                max_slope: self.max_slope.read(),
                min_supply: self.min_supply.read(),
                max_supply: self.max_supply.read(),
            }
        }

        /// Sets the curve limits (owner only)
        /// Requirements: 9.3, 9.4
        fn set_curve_limits(
            ref self: ContractState,
            min_base_price: u256,
            max_base_price: u256,
            min_slope: u256,
            max_slope: u256,
            min_supply: u256,
            max_supply: u256
        ) {
            // Only owner can update curve limits
            assert_only_owner(@self);
            
            self.min_base_price.write(min_base_price);
            self.max_base_price.write(max_base_price);
            self.min_slope.write(min_slope);
            self.max_slope.write(max_slope);
            self.min_supply.write(min_supply);
            self.max_supply.write(max_supply);
            
            self.emit(CurveLimitsUpdated {
                min_base_price,
                max_base_price,
                min_slope,
                max_slope,
                min_supply,
                max_supply,
            });
        }

        /// Returns the contract owner address
        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }
}

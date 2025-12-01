use starknet::ContractAddress;
use starknet::get_caller_address;

#[starknet::contract]
mod ProtocolConfig {
    use super::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        fee_bps: u16,          // e.g. 300 = 3%
        fee_receiver: ContractAddress,
        min_base_price: u256,
        max_base_price: u256,
        min_slope: u256,
        max_slope: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        FeeConfigUpdated: FeeConfigUpdated,
        CurveLimitsUpdated: CurveLimitsUpdated,
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
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        fee_bps: u16,
        fee_receiver: ContractAddress
    ) {
        self.owner.write(owner);
        self.fee_bps.write(fee_bps);
        self.fee_receiver.write(fee_receiver);
        self.min_base_price.write(0);
        self.max_base_price.write(10000000); // dummy
        self.min_slope.write(1);
        self.max_slope.write(10000000);
    }

    fn only_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'ONLY_OWNER');
    }

    fn owner(self: @ContractState) -> ContractAddress {
        self.owner.read()
    }

    fn get_fee_config(self: @ContractState) -> (u16, ContractAddress) {
        (self.fee_bps.read(), self.fee_receiver.read())
    }

    fn get_curve_limits(self: @ContractState) -> (u256, u256, u256, u256) {
        (
            self.min_base_price.read(),
            self.max_base_price.read(),
            self.min_slope.read(),
            self.max_slope.read()
        )
    }

    #[external(v0)]
    fn set_fee_config(
        ref self: ContractState,
        fee_bps: u16,
        fee_receiver: ContractAddress
    ) {
        only_owner(@self);
        self.fee_bps.write(fee_bps);
        self.fee_receiver.write(fee_receiver);
        self.emit(FeeConfigUpdated { fee_bps, fee_receiver });
    }

    #[external(v0)]
    fn set_curve_limits(
        ref self: ContractState,
        min_base: u256,
        max_base: u256,
        min_slope: u256,
        max_slope: u256
    ) {
        only_owner(@self);
        self.min_base_price.write(min_base);
        self.max_base_price.write(max_base);
        self.min_slope.write(min_slope);
        self.max_slope.write(max_slope);
        self.emit(CurveLimitsUpdated { 
            min_base_price: min_base,
            max_base_price: max_base,
            min_slope,
            max_slope
        });
    }
}


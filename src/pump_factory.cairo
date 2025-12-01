use starknet::ContractAddress;
use starknet::get_caller_address;

#[derive(Copy, Drop, Serde, starknet::Store)]
struct LaunchInfo {
    token: ContractAddress,
    pool: ContractAddress,
    creator: ContractAddress,
    name: felt252,
    symbol: felt252,
    base_price: u256,
    slope: u256,
    max_supply: u256,
    migrated: bool,
}

#[starknet::contract]
#[feature("deprecated_legacy_map")]
mod PumpFactory {
    use super::{ContractAddress, get_caller_address, LaunchInfo};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };

    #[storage]
    struct Storage {
        launches: LegacyMap<u256, LaunchInfo>,
        launch_count: u256,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LaunchRegistered: LaunchRegistered,
        LaunchMigrated: LaunchMigrated,
    }

    #[derive(Drop, starknet::Event)]
    struct LaunchRegistered {
        #[key]
        launch_id: u256,
        token: ContractAddress,
        pool: ContractAddress,
        creator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct LaunchMigrated {
        #[key]
        launch_id: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.launch_count.write(0);
    }

    fn owner(self: @ContractState) -> ContractAddress {
        self.owner.read()
    }

    fn total_launches(self: @ContractState) -> u256 {
        self.launch_count.read()
    }

    fn get_launch(
        self: @ContractState,
        launch_id: u256
    ) -> LaunchInfo {
        self.launches.read(launch_id)
    }

    // For PoC: called by off-chain script after deploying MemecoinToken + BondingCurvePool
    #[external(v0)]
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
        let info = LaunchInfo {
            token,
            pool,
            creator,
            name,
            symbol,
            base_price,
            slope,
            max_supply,
            migrated: false,
        };
        self.launches.write(id, info);
        self.launch_count.write(id + 1);
        self.emit(LaunchRegistered { launch_id: id, token, pool, creator });
        id
    }

    // Called by LiquidityMigration later
    #[external(v0)]
    fn mark_migrated(
        ref self: ContractState,
        launch_id: u256
    ) {
        let _caller = get_caller_address();
        // TODO: restrict to LiquidityMigration contract in prod
        let mut info = self.launches.read(launch_id);
        let mut updated_info = LaunchInfo {
            token: info.token,
            pool: info.pool,
            creator: info.creator,
            name: info.name,
            symbol: info.symbol,
            base_price: info.base_price,
            slope: info.slope,
            max_supply: info.max_supply,
            migrated: true,
        };
        self.launches.write(launch_id, updated_info);
        self.emit(LaunchMigrated { launch_id });
    }
}


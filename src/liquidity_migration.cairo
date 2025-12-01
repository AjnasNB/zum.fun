use starknet::ContractAddress;
use starknet::get_caller_address;

#[starknet::interface]
trait IBondingCurvePool<TContractState> {
    fn set_migrated(ref self: TContractState);
}

#[starknet::interface]
trait IFactory<TContractState> {
    fn mark_migrated(ref self: TContractState, launch_id: u256);
}

#[starknet::contract]
mod LiquidityMigration {
    use super::{
        ContractAddress,
        get_caller_address,
        IBondingCurvePoolDispatcher, IBondingCurvePoolDispatcherTrait,
        IFactoryDispatcher, IFactoryDispatcherTrait
    };
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        factory: ContractAddress,
        // later: router, LP token, lock rules, etc.
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        MigrationCompleted: MigrationCompleted,
    }

    #[derive(Drop, starknet::Event)]
    struct MigrationCompleted {
        #[key]
        launch_id: u256,
        #[key]
        pool: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        factory: ContractAddress
    ) {
        self.owner.write(owner);
        self.factory.write(factory);
    }

    fn owner(self: @ContractState) -> ContractAddress {
        self.owner.read()
    }

    fn factory(self: @ContractState) -> ContractAddress {
        self.factory.read()
    }

    #[external(v0)]
    fn migrate_stub(
        ref self: ContractState,
        launch_id: u256,
        pool_addr: ContractAddress
    ) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'ONLY_OWNER');
        // In future: pull reserves, call DEX, lock LP
        // For PoC: just mark migrated
        let mut pool = IBondingCurvePoolDispatcher { contract_address: pool_addr };
        pool.set_migrated();

        let factory_addr = self.factory.read();
        let mut factory = IFactoryDispatcher { contract_address: factory_addr };
        factory.mark_migrated(launch_id);

        self.emit(MigrationCompleted { launch_id, pool: pool_addr });
    }
}


use starknet::ContractAddress;

#[starknet::interface]
trait IPool<TContractState> {
    fn get_reserves(self: @TContractState) -> (u256, u256);
    fn migrate_liquidity(ref self: TContractState, to: ContractAddress);
}

#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
mod ZkDexHook {
    use super::ContractAddress;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::get_caller_address;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        dex_router: ContractAddress,
        lp_lock_duration: u64,
        locked_lp: LegacyMap<ContractAddress, (ContractAddress, u64)>, // pool -> (lp_token, unlock_time)
        sniper_protection: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LiquidityProtected: LiquidityProtected,
        LPUnlocked: LPUnlocked,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidityProtected {
        #[key]
        pool: ContractAddress,
        #[key]
        lp_token: ContractAddress,
        unlock_time: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct LPUnlocked {
        #[key]
        pool: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        dex_router: ContractAddress
    ) {
        self.owner.write(owner);
        self.dex_router.write(dex_router);
        self.lp_lock_duration.write(2592000); // 30 days default
        self.sniper_protection.write(true);
    }

    fn only_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'ONLY_OWNER');
    }

    // Migrate liquidity to DEX with LP lock (sniper protection)
    #[external(v0)]
    fn migrate_with_protection(
        ref self: ContractState,
        pool: ContractAddress,
        lp_token: ContractAddress
    ) {
        only_owner(@self);
        
        // Lock LP tokens
        let current_time = starknet::get_block_timestamp();
        let unlock_time = current_time + self.lp_lock_duration.read();
        self.locked_lp.write(pool, (lp_token, unlock_time));
        
        self.emit(LiquidityProtected { 
            pool, 
            lp_token, 
            unlock_time 
        });
    }

    // Unlock LP after duration (only if time passed)
    #[external(v0)]
    fn unlock_liquidity(
        ref self: ContractState,
        pool: ContractAddress
    ) {
        only_owner(@self);
        let (lp_token, unlock_time) = self.locked_lp.read(pool);
        let current_time = starknet::get_block_timestamp();
        assert(current_time >= unlock_time, 'STILL_LOCKED');
        
        self.locked_lp.write(pool, (lp_token, 0));
        self.emit(LPUnlocked { pool });
    }

    // Check if liquidity is protected
    fn is_protected(self: @ContractState, pool: ContractAddress) -> bool {
        let (_, unlock_time) = self.locked_lp.read(pool);
        unlock_time > 0
    }
}


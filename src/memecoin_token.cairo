use starknet::ContractAddress;
use starknet::get_caller_address;

#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
mod MemecoinToken {
    use super::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };

    #[storage]
    struct Storage {
        name: felt252,
        symbol: felt252,
        decimals: u8,
        total_supply: u256,
        balances: LegacyMap<ContractAddress, u256>,
        allowances: LegacyMap<(ContractAddress, ContractAddress), u256>,
        minter: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        #[key]
        owner: ContractAddress,
        #[key]
        spender: ContractAddress,
        value: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: felt252,
        symbol: felt252,
        decimals: u8,
        initial_minter: ContractAddress
    ) {
        self.name.write(name);
        self.symbol.write(symbol);
        self.decimals.write(decimals);
        self.minter.write(initial_minter);
        self.total_supply.write(0);
    }

    // Views
    fn name(self: @ContractState) -> felt252 { 
        self.name.read() 
    }

    fn symbol(self: @ContractState) -> felt252 { 
        self.symbol.read() 
    }

    fn decimals(self: @ContractState) -> u8 { 
        self.decimals.read() 
    }

    fn total_supply(self: @ContractState) -> u256 { 
        self.total_supply.read() 
    }

    fn balance_of(self: @ContractState, owner: ContractAddress) -> u256 {
        self.balances.read(owner)
    }

    fn allowance(
        self: @ContractState,
        owner: ContractAddress,
        spender: ContractAddress
    ) -> u256 {
        self.allowances.read((owner, spender))
    }

    fn minter(self: @ContractState) -> ContractAddress {
        self.minter.read()
    }

    // Transfers
    #[external(v0)]
    fn transfer(
        ref self: ContractState,
        to: ContractAddress,
        amount: u256
    ) -> bool {
        let from = get_caller_address();
        _transfer(ref self, from, to, amount);
        true
    }

    #[external(v0)]
    fn approve(
        ref self: ContractState,
        spender: ContractAddress,
        amount: u256
    ) -> bool {
        let owner = get_caller_address();
        self.allowances.write((owner, spender), amount);
        self.emit(Approval { owner, spender, value: amount });
        true
    }

    #[external(v0)]
    fn transfer_from(
        ref self: ContractState,
        from: ContractAddress,
        to: ContractAddress,
        amount: u256
    ) -> bool {
        let caller = get_caller_address();
        let allowed = self.allowances.read((from, caller));
        assert(allowed >= amount, 'NOT_ALLOWED');
        self.allowances.write((from, caller), allowed - amount);
        _transfer(ref self, from, to, amount);
        true
    }

    fn _transfer(
        ref self: ContractState,
        from: ContractAddress,
        to: ContractAddress,
        amount: u256
    ) {
        let from_bal = self.balances.read(from);
        assert(from_bal >= amount, 'INSUFFICIENT_BALANCE');
        self.balances.write(from, from_bal - amount);
        let to_bal = self.balances.read(to);
        self.balances.write(to, to_bal + amount);
        self.emit(Transfer { from, to, value: amount });
    }

    // Mint / Burn – only minter (BondingCurvePool)
    #[external(v0)]
    fn mint(
        ref self: ContractState,
        to: ContractAddress,
        amount: u256
    ) {
        let caller = get_caller_address();
        let minter = self.minter.read();
        assert(caller == minter, 'NOT_MINTER');
        let total = self.total_supply.read();
        self.total_supply.write(total + amount);
        let bal = self.balances.read(to);
        self.balances.write(to, bal + amount);
        let zero_address = starknet::contract_address_const::<0>();
        self.emit(Transfer { 
            from: zero_address, 
            to, 
            value: amount 
        });
    }

    #[external(v0)]
    fn burn(
        ref self: ContractState,
        from: ContractAddress,
        amount: u256
    ) {
        let caller = get_caller_address();
        let minter = self.minter.read();
        assert(caller == minter, 'NOT_MINTER');
        let bal = self.balances.read(from);
        assert(bal >= amount, 'INSUFFICIENT_BALANCE');
        self.balances.write(from, bal - amount);
        let total = self.total_supply.read();
        self.total_supply.write(total - amount);
        let zero_address = starknet::contract_address_const::<0>();
        self.emit(Transfer { 
            from, 
            to: zero_address, 
            value: amount 
        });
    }

    #[external(v0)]
    fn update_minter(
        ref self: ContractState,
        new_minter: ContractAddress
    ) {
        let caller = get_caller_address();
        let current_minter = self.minter.read();
        assert(caller == current_minter, 'ONLY_CURRENT_MINTER');
        self.minter.write(new_minter);
    }
}

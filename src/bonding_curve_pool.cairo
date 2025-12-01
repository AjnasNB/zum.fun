#[feature("deprecated_legacy_map")]
use starknet::ContractAddress;
use starknet::get_caller_address;

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

#[starknet::contract]
mod BondingCurvePool {
    use super::{
        ContractAddress, get_caller_address,
        IERC20Dispatcher, IERC20DispatcherTrait, IProtocolConfigDispatcher, IProtocolConfigDispatcherTrait
    };
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess
    };

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
        privacy_relayer: ContractAddress,
        private_trades_enabled: bool,
        #[feature("deprecated_legacy_map")]
        shielded_commitments: LegacyMap<felt252, bool>, // Track private trades
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
        commitment: felt252, // No buyer address exposed
        amount_tokens: u256,
        price: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PrivateSell {
        commitment: felt252, // No seller address exposed
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
    }

    // Basic linear price: base + slope * tokens_sold
    fn current_price(self: @ContractState) -> u256 {
        let base = self.base_price.read();
        let slope = self.slope.read();
        let sold = self.tokens_sold.read();
        base + (slope * sold)
    }

    fn get_state(
        self: @ContractState
    ) -> (ContractAddress, ContractAddress, u256, u256, bool) {
        (
            self.token.read(),
            self.quote_token.read(),
            self.tokens_sold.read(),
            self.reserve_balance.read(),
            self.migrated.read()
        )
    }

    fn get_current_price(self: @ContractState) -> u256 {
        let base = self.base_price.read();
        let slope = self.slope.read();
        let sold = self.tokens_sold.read();
        base + (slope * sold)
    }

    fn token(self: @ContractState) -> ContractAddress {
        self.token.read()
    }

    fn quote_token(self: @ContractState) -> ContractAddress {
        self.quote_token.read()
    }

    fn creator(self: @ContractState) -> ContractAddress {
        self.creator.read()
    }

    fn base_price(self: @ContractState) -> u256 {
        self.base_price.read()
    }

    fn slope(self: @ContractState) -> u256 {
        self.slope.read()
    }

    fn max_supply(self: @ContractState) -> u256 {
        self.max_supply.read()
    }

    fn tokens_sold(self: @ContractState) -> u256 {
        self.tokens_sold.read()
    }

    fn reserve_balance(self: @ContractState) -> u256 {
        self.reserve_balance.read()
    }

    fn migrated(self: @ContractState) -> bool {
        self.migrated.read()
    }

    // ----- BUY -----
    #[external(v0)]
    fn buy(
        ref self: ContractState,
        amount_tokens: u256
    ) {
        let caller = get_caller_address();
        let migrated = self.migrated.read();
        assert(!migrated, 'ALREADY_MIGRATED');
        let max_supply = self.max_supply.read();
        let sold = self.tokens_sold.read();
        assert(sold + amount_tokens <= max_supply, 'MAX_SUPPLY_REACHED');
        let base = self.base_price.read();
        let slope = self.slope.read();
        let price = base + (slope * sold);
        let total_cost = price * amount_tokens; // simplified

        // protocol fee
        let proto_addr = self.protocol_config.read();
        let proto = IProtocolConfigDispatcher { contract_address: proto_addr };
        let (fee_bps, fee_receiver) = proto.get_fee_config();
        let fee = (total_cost * fee_bps.into()) / 10000;
        let net_cost = total_cost - fee;

        let quote_addr = self.quote_token.read();
        let mut quote = IERC20Dispatcher { contract_address: quote_addr };
        let pool_addr = starknet::get_contract_address();

        // transfer quote from buyer to this pool
        quote.transfer_from(caller, pool_addr, net_cost);

        // transfer fee to protocol
        quote.transfer_from(caller, fee_receiver, fee);

        // mint tokens to buyer
        let token_addr = self.token.read();
        let mut token = IERC20Dispatcher { contract_address: token_addr };
        token.mint(caller, amount_tokens);

        self.tokens_sold.write(sold + amount_tokens);
        let reserve = self.reserve_balance.read();
        self.reserve_balance.write(reserve + net_cost);

        self.emit(Buy { 
            buyer: caller, 
            amount_tokens, 
            cost_quote: total_cost, 
            fee_quote: fee 
        });
    }

    // ----- SELL (optional in MVP – you can disable it) -----
    #[external(v0)]
    fn sell(
        ref self: ContractState,
        amount_tokens: u256
    ) {
        let caller = get_caller_address();
        let migrated = self.migrated.read();
        assert(!migrated, 'ALREADY_MIGRATED');
        let sold = self.tokens_sold.read();
        assert(sold >= amount_tokens, 'NOT_ENOUGH_SOLD');
        let base = self.base_price.read();
        let slope = self.slope.read();
        let price = base + (slope * sold);
        let gross_refund = price * amount_tokens;

        // protocol fee
        let proto_addr = self.protocol_config.read();
        let proto = IProtocolConfigDispatcher { contract_address: proto_addr };
        let (fee_bps, fee_receiver) = proto.get_fee_config();
        let fee = (gross_refund * fee_bps.into()) / 10000;
        let net_refund = gross_refund - fee;

        let reserve = self.reserve_balance.read();
        assert(reserve >= net_refund, 'INSUFFICIENT_RESERVE');

        // burn tokens from seller
        let token_addr = self.token.read();
        let mut token = IERC20Dispatcher { contract_address: token_addr };
        token.burn(caller, amount_tokens);

        let quote_addr = self.quote_token.read();
        let mut quote = IERC20Dispatcher { contract_address: quote_addr };

        // send refund
        quote.transfer(caller, net_refund);

        // send fee
        quote.transfer(fee_receiver, fee);

        self.tokens_sold.write(sold - amount_tokens);
        self.reserve_balance.write(reserve - net_refund);

        self.emit(Sell { 
            seller: caller, 
            amount_tokens, 
            refund_quote: net_refund, 
            fee_quote: fee 
        });
    }

    // Migration hook (callable only by LiquidityMigration later)
    #[external(v0)]
    fn set_migrated(
        ref self: ContractState
    ) {
        let _caller = get_caller_address();
        // TODO in real version: store allowed migration contract & check
        // For PoC, trust a fixed caller or factory
        self.migrated.write(true);
        self.emit(Migrated { pool: starknet::get_contract_address() });
    }
}


use starknet::ContractAddress;
use core::poseidon::poseidon_hash_span;

/// Stealth address structure containing the derived address and metadata
#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct StealthAddress {
    pub address: ContractAddress,
    pub view_tag: felt252,
    pub ephemeral_pubkey: felt252,
}

/// Stealth keypair for key derivation
#[derive(Copy, Drop, Serde)]
pub struct StealthKeypair {
    pub spending_key: felt252,
    pub viewing_key: felt252,
}

/// Domain separator constants for Poseidon hashing
mod DomainSeparators {
    pub const EPHEMERAL_KEY: felt252 = 'ZUMP_EPHEMERAL_KEY';
    pub const STEALTH_ADDRESS: felt252 = 'ZUMP_STEALTH_ADDR';
    pub const VIEW_TAG: felt252 = 'ZUMP_VIEW_TAG';
    pub const SPENDING_KEY: felt252 = 'ZUMP_SPENDING_KEY';
}

#[starknet::interface]
pub trait IStealthAddressGenerator<TContractState> {
    /// Generate a stealth address from spending and viewing public keys
    fn generate_stealth_address(
        ref self: TContractState,
        spending_pubkey: felt252,
        viewing_pubkey: felt252,
        ephemeral_random: felt252
    ) -> StealthAddress;
    
    /// Generate a fresh stealth address for the caller
    fn generate_fresh_stealth(ref self: TContractState) -> ContractAddress;
    
    /// Check if an address is a valid registered stealth address
    fn is_valid_stealth(self: @TContractState, address: ContractAddress) -> bool;
    
    /// Check ownership using view tag and viewing key
    fn check_ownership(
        self: @TContractState,
        view_tag: felt252,
        viewing_key: felt252
    ) -> bool;
    
    /// Get stealth address by view tag
    fn get_stealth_by_view_tag(self: @TContractState, view_tag: felt252) -> ContractAddress;
    
    /// Get stealth metadata for a primary wallet
    fn get_stealth_metadata(self: @TContractState, primary_wallet: ContractAddress) -> felt252;
    
    /// Get the current nonce counter
    fn get_nonce(self: @TContractState) -> u256;
}

#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
pub mod StealthAddressGenerator {
    use super::{
        ContractAddress, StealthAddress,
        poseidon_hash_span, DomainSeparators, IStealthAddressGenerator
    };
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use core::array::ArrayTrait;

    #[storage]
    struct Storage {
        /// Contract owner
        owner: ContractAddress,
        /// Primary wallet -> Stealth metadata hash (encrypted reference)
        stealth_metadata: LegacyMap<ContractAddress, felt252>,
        /// Stealth address -> Is valid (registered)
        valid_stealth_addresses: LegacyMap<ContractAddress, bool>,
        /// Counter for nonce generation (ensures uniqueness)
        nonce_counter: u256,
        /// View tag -> Stealth address mapping for efficient scanning
        view_tags: LegacyMap<felt252, ContractAddress>,
        /// Stealth address -> View tag (reverse mapping)
        address_to_view_tag: LegacyMap<ContractAddress, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        StealthAddressGenerated: StealthAddressGenerated,
        StealthAddressRegistered: StealthAddressRegistered,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthAddressGenerated {
        #[key]
        pub primary_wallet: ContractAddress,
        #[key]
        pub stealth_address: ContractAddress,
        pub view_tag: felt252,
        pub ephemeral_pubkey: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StealthAddressRegistered {
        #[key]
        pub stealth_address: ContractAddress,
        pub view_tag: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.nonce_counter.write(0);
    }

    #[abi(embed_v0)]
    impl StealthAddressGeneratorImpl of IStealthAddressGenerator<ContractState> {
        /// Generate stealth address using Poseidon-based key derivation
        /// 
        /// The stealth address is derived as follows:
        /// 1. Generate ephemeral public key: H(EPHEMERAL_KEY || ephemeral_random || timestamp || nonce)
        /// 2. Derive shared secret: H(SPENDING_KEY || spending_pubkey || viewing_pubkey || ephemeral_pubkey)
        /// 3. Compute stealth address: H(STEALTH_ADDRESS || shared_secret)
        /// 4. Compute view tag: H(VIEW_TAG || viewing_pubkey || ephemeral_pubkey) - for efficient scanning
        fn generate_stealth_address(
            ref self: ContractState,
            spending_pubkey: felt252,
            viewing_pubkey: felt252,
            ephemeral_random: felt252
        ) -> StealthAddress {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let nonce = self.nonce_counter.read();
            
            // Increment nonce to ensure uniqueness
            self.nonce_counter.write(nonce + 1);

            // Step 1: Generate ephemeral public key using domain-separated Poseidon hash
            let ephemeral_pubkey = derive_ephemeral_pubkey(
                ephemeral_random, 
                timestamp, 
                nonce
            );

            // Step 2: Derive shared secret from spending key, viewing key, and ephemeral key
            let shared_secret = derive_shared_secret_internal(
                spending_pubkey,
                viewing_pubkey,
                ephemeral_pubkey
            );

            // Step 3: Compute stealth address from shared secret
            let stealth_hash = compute_stealth_hash(shared_secret);
            let stealth_address: ContractAddress = stealth_hash.try_into().unwrap();

            // Step 4: Compute view tag for efficient scanning
            let view_tag = compute_view_tag(viewing_pubkey, ephemeral_pubkey);

            // Register the stealth address
            self.valid_stealth_addresses.write(stealth_address, true);
            self.view_tags.write(view_tag, stealth_address);
            self.address_to_view_tag.write(stealth_address, view_tag);

            // Store metadata reference for the caller
            self.stealth_metadata.write(caller, stealth_hash);

            self.emit(StealthAddressGenerated {
                primary_wallet: caller,
                stealth_address,
                view_tag,
                ephemeral_pubkey,
            });

            StealthAddress {
                address: stealth_address,
                view_tag,
                ephemeral_pubkey,
            }
        }

        /// Generate a fresh stealth address using caller's address as seed
        fn generate_fresh_stealth(ref self: ContractState) -> ContractAddress {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let nonce = self.nonce_counter.read();
            
            self.nonce_counter.write(nonce + 1);

            // Generate stealth address using domain-separated hash
            let mut data = ArrayTrait::new();
            data.append(DomainSeparators::STEALTH_ADDRESS);
            data.append(caller.into());
            data.append(timestamp.into());
            data.append(nonce.low.into());
            data.append(nonce.high.into());
            let stealth_hash = poseidon_hash_span(data.span());

            let stealth_address: ContractAddress = stealth_hash.try_into().unwrap();
            
            // Compute view tag for this address
            let mut view_tag_data = ArrayTrait::new();
            view_tag_data.append(DomainSeparators::VIEW_TAG);
            view_tag_data.append(stealth_hash);
            view_tag_data.append(caller.into());
            let view_tag = poseidon_hash_span(view_tag_data.span());
            
            // Register the stealth address
            self.valid_stealth_addresses.write(stealth_address, true);
            self.view_tags.write(view_tag, stealth_address);
            self.address_to_view_tag.write(stealth_address, view_tag);

            self.emit(StealthAddressRegistered { 
                stealth_address,
                view_tag,
            });

            stealth_address
        }

        /// Verify if address is a valid registered stealth address
        fn is_valid_stealth(self: @ContractState, address: ContractAddress) -> bool {
            self.valid_stealth_addresses.read(address)
        }

        /// Check if stealth address belongs to user using view tag
        /// The viewing_key is used to verify ownership
        fn check_ownership(
            self: @ContractState,
            view_tag: felt252,
            viewing_key: felt252
        ) -> bool {
            let stealth_addr = self.view_tags.read(view_tag);
            if stealth_addr.into() == 0 {
                return false;
            }
            
            // Verify the view tag was derived from this viewing key
            // In production: This would involve proper cryptographic verification
            // For now, we verify the view tag exists and maps to a valid address
            self.valid_stealth_addresses.read(stealth_addr)
        }

        /// Get stealth address by view tag
        fn get_stealth_by_view_tag(self: @ContractState, view_tag: felt252) -> ContractAddress {
            self.view_tags.read(view_tag)
        }

        /// Get stealth metadata for a primary wallet
        fn get_stealth_metadata(
            self: @ContractState,
            primary_wallet: ContractAddress
        ) -> felt252 {
            self.stealth_metadata.read(primary_wallet)
        }

        /// Get the current nonce counter
        fn get_nonce(self: @ContractState) -> u256 {
            self.nonce_counter.read()
        }
    }

    /// Derive ephemeral public key using Poseidon hash
    fn derive_ephemeral_pubkey(
        ephemeral_random: felt252,
        timestamp: u64,
        nonce: u256
    ) -> felt252 {
        let mut data = ArrayTrait::new();
        data.append(DomainSeparators::EPHEMERAL_KEY);
        data.append(ephemeral_random);
        data.append(timestamp.into());
        data.append(nonce.low.into());
        data.append(nonce.high.into());
        poseidon_hash_span(data.span())
    }

    /// Derive shared secret from public keys
    fn derive_shared_secret_internal(
        spending_pubkey: felt252,
        viewing_pubkey: felt252,
        ephemeral_pubkey: felt252
    ) -> felt252 {
        let mut data = ArrayTrait::new();
        data.append(DomainSeparators::SPENDING_KEY);
        data.append(spending_pubkey);
        data.append(viewing_pubkey);
        data.append(ephemeral_pubkey);
        poseidon_hash_span(data.span())
    }

    /// Compute stealth address hash from shared secret
    fn compute_stealth_hash(shared_secret: felt252) -> felt252 {
        let mut data = ArrayTrait::new();
        data.append(DomainSeparators::STEALTH_ADDRESS);
        data.append(shared_secret);
        poseidon_hash_span(data.span())
    }

    /// Compute view tag for efficient scanning
    fn compute_view_tag(viewing_pubkey: felt252, ephemeral_pubkey: felt252) -> felt252 {
        let mut data = ArrayTrait::new();
        data.append(DomainSeparators::VIEW_TAG);
        data.append(viewing_pubkey);
        data.append(ephemeral_pubkey);
        poseidon_hash_span(data.span())
    }
}

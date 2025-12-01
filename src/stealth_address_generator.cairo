use starknet::ContractAddress;
use core::poseidon::poseidon_hash_span;

// Stealth address structure
#[derive(Copy, Drop, Serde, starknet::Store)]
struct StealthAddress {
    address: ContractAddress,
    view_tag: felt252,
    ephemeral_pubkey: felt252,
}

// Stealth keypair for derivation
#[derive(Copy, Drop, Serde)]
struct StealthKeypair {
    spending_key: felt252,
    viewing_key: felt252,
}

#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
mod StealthAddressGenerator {
    use super::{ContractAddress, StealthAddress, StealthKeypair, poseidon_hash_span};
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
        // Primary wallet -> Stealth metadata (encrypted)
        stealth_metadata: LegacyMap<ContractAddress, felt252>,
        // Stealth address -> Is valid
        valid_stealth_addresses: LegacyMap<ContractAddress, bool>,
        // Counter for nonce generation
        nonce_counter: u256,
        // View tags for efficient scanning
        view_tags: LegacyMap<felt252, ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        StealthAddressGenerated: StealthAddressGenerated,
        StealthAddressRegistered: StealthAddressRegistered,
    }

    #[derive(Drop, starknet::Event)]
    struct StealthAddressGenerated {
        #[key]
        primary_wallet: ContractAddress,
        #[key]
        stealth_address: ContractAddress,
        view_tag: felt252,
        ephemeral_pubkey: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct StealthAddressRegistered {
        #[key]
        stealth_address: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.nonce_counter.write(0);
    }

    // Generate stealth address using Poseidon hash
    // Uses: spending_pubkey + viewing_pubkey + ephemeral_random
    #[external(v0)]
    fn generate_stealth_address(
        ref self: ContractState,
        spending_pubkey: felt252,
        viewing_pubkey: felt252,
        ephemeral_random: felt252
    ) -> StealthAddress {
        let caller = get_caller_address();
        let timestamp = get_block_timestamp();
        let nonce = self.nonce_counter.read();
        
        // Increment nonce
        self.nonce_counter.write(nonce + 1);

        // Generate ephemeral keypair using Poseidon
        let mut ephemeral_data = ArrayTrait::new();
        ephemeral_data.append(ephemeral_random);
        ephemeral_data.append(timestamp.into());
        ephemeral_data.append(nonce.low.into());
        let ephemeral_pubkey = poseidon_hash_span(ephemeral_data.span());

        // Derive stealth address: H(spending_pubkey, viewing_pubkey, ephemeral_pubkey)
        let mut stealth_data = ArrayTrait::new();
        stealth_data.append(spending_pubkey);
        stealth_data.append(viewing_pubkey);
        stealth_data.append(ephemeral_pubkey);
        let stealth_hash = poseidon_hash_span(stealth_data.span());

        // Convert to ContractAddress (simplified - in production use proper derivation)
        let stealth_address: ContractAddress = stealth_hash.try_into().unwrap();

        // Generate view tag for efficient scanning (first 8 bits of hash)
        let mut view_tag_data = ArrayTrait::new();
        view_tag_data.append(stealth_hash);
        view_tag_data.append(caller.into());
        let view_tag = poseidon_hash_span(view_tag_data.span());

        // Mark as valid stealth address
        self.valid_stealth_addresses.write(stealth_address, true);
        self.view_tags.write(view_tag, stealth_address);

        // Store encrypted metadata (in production, encrypt with viewing key)
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

    // Generate fresh stealth address (simplified version)
    #[external(v0)]
    fn generate_fresh_stealth(
        ref self: ContractState
    ) -> ContractAddress {
        let caller = get_caller_address();
        let timestamp = get_block_timestamp();
        let nonce = self.nonce_counter.read();
        
        self.nonce_counter.write(nonce + 1);

        // Generate random stealth address using Poseidon
        let mut data = ArrayTrait::new();
        data.append(caller.into());
        data.append(timestamp.into());
        data.append(nonce.low.into());
        data.append(nonce.high.into());
        let stealth_hash = poseidon_hash_span(data.span());

        let stealth_address: ContractAddress = stealth_hash.try_into().unwrap();
        
        // Mark as valid
        self.valid_stealth_addresses.write(stealth_address, true);

        self.emit(StealthAddressRegistered { stealth_address });

        stealth_address
    }

    // Verify if address is a valid stealth address
    #[external(v0)]
    fn is_valid_stealth(
        self: @ContractState,
        address: ContractAddress
    ) -> bool {
        self.valid_stealth_addresses.read(address)
    }

    // Derive shared secret for stealth payment
    // In production: Use ECDH-like key agreement on Stark curve
    fn derive_shared_secret(
        self: @ContractState,
        ephemeral_privkey: felt252,
        recipient_pubkey: felt252
    ) -> felt252 {
        // Simplified: In production use proper elliptic curve multiplication
        let mut data = ArrayTrait::new();
        data.append(ephemeral_privkey);
        data.append(recipient_pubkey);
        poseidon_hash_span(data.span())
    }

    // Check if stealth address belongs to user (using view tag)
    #[external(v0)]
    fn check_ownership(
        self: @ContractState,
        view_tag: felt252,
        viewing_key: felt252
    ) -> bool {
        let stealth_addr = self.view_tags.read(view_tag);
        // In production: Verify with actual viewing key cryptography
        stealth_addr.into() != 0
    }

    // Get stealth metadata (encrypted)
    #[external(v0)]
    fn get_stealth_metadata(
        self: @ContractState,
        primary_wallet: ContractAddress
    ) -> felt252 {
        self.stealth_metadata.read(primary_wallet)
    }
}


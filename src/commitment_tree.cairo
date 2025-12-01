use starknet::ContractAddress;
use core::poseidon::poseidon_hash_span;

// Merkle tree node
#[derive(Copy, Drop, Serde, starknet::Store)]
struct TreeNode {
    hash: felt252,
    left: felt252,
    right: felt252,
}

// Merkle proof path
#[derive(Copy, Drop, Serde)]
struct MerkleProof {
    leaf: felt252,
    path: Span<felt252>,
    indices: Span<u8>, // 0 = left, 1 = right
}

#[starknet::contract]
#[feature("deprecated_legacy_map")]
#[feature("deprecated-starknet-consts")]
mod CommitmentTree {
    use super::{ContractAddress, TreeNode, MerkleProof, poseidon_hash_span};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess
    };
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use core::array::ArrayTrait;

    const TREE_DEPTH: u32 = 20; // Supports 2^20 = 1M commitments

    #[storage]
    struct Storage {
        owner: ContractAddress,
        // Merkle tree leaves (commitments)
        leaves: LegacyMap<u256, felt252>,
        // Current leaf count
        next_leaf_index: u256,
        // Merkle tree roots (historical)
        roots: LegacyMap<u256, felt252>, // root_index -> root_hash
        current_root_index: u256,
        // Current Merkle root
        current_root: felt252,
        // Authorized inserters (pools, mixers, etc.)
        authorized_inserters: LegacyMap<ContractAddress, bool>,
        // Zero values for empty nodes at each level
        zero_values: LegacyMap<u32, felt252>,
        // Filled subtrees (optimization for batch inserts)
        filled_subtrees: LegacyMap<u32, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LeafInserted: LeafInserted,
        RootUpdated: RootUpdated,
        InserterAuthorized: InserterAuthorized,
    }

    #[derive(Drop, starknet::Event)]
    struct LeafInserted {
        #[key]
        leaf: felt252,
        leaf_index: u256,
        new_root: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct RootUpdated {
        old_root: felt252,
        new_root: felt252,
        root_index: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct InserterAuthorized {
        #[key]
        inserter: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress
    ) {
        self.owner.write(owner);
        self.next_leaf_index.write(0);
        self.current_root_index.write(0);
        
        // Initialize zero values for empty tree
        self.initialize_zero_values();
        
        // Set initial root to zero value at depth 0
        let zero_root = self.zero_values.read(0);
        self.current_root.write(zero_root);
    }

    fn only_owner(self: @ContractState) {
        let caller = get_caller_address();
        let owner = self.owner.read();
        assert(caller == owner, 'ONLY_OWNER');
    }

    fn only_authorized(self: @ContractState) {
        let caller = get_caller_address();
        let is_authorized = self.authorized_inserters.read(caller);
        assert(is_authorized, 'NOT_AUTHORIZED');
    }

    // Initialize zero values for empty Merkle tree
    fn initialize_zero_values(ref self: ContractState) {
        // Zero value at max depth (leaf level)
        let mut zero = 0;
        self.zero_values.write(TREE_DEPTH, zero);
        
        // Compute zero values for each level going up
        let mut level = TREE_DEPTH;
        loop {
            if level == 0 {
                break;
            }
            
            level -= 1;
            
            // Hash(zero, zero) for this level
            let mut data = ArrayTrait::new();
            data.append(zero);
            data.append(zero);
            zero = poseidon_hash_span(data.span());
            
            self.zero_values.write(level, zero);
        };
    }

    // Insert commitment (leaf) into Merkle tree
    #[external(v0)]
    fn insert_commitment(
        ref self: ContractState,
        commitment: felt252
    ) -> u256 {
        only_authorized(@self);
        
        assert(commitment != 0, 'INVALID_COMMITMENT');
        
        // Get next leaf index
        let leaf_index = self.next_leaf_index.read();
        
        // Store leaf
        self.leaves.write(leaf_index, commitment);
        
        // Update next index
        self.next_leaf_index.write(leaf_index + 1);
        
        // Update Merkle root
        let new_root = self.update_tree(commitment, leaf_index);
        
        self.emit(LeafInserted {
            leaf: commitment,
            leaf_index,
            new_root,
        });
        
        leaf_index
    }

    // Batch insert commitments (optimized)
    #[external(v0)]
    fn batch_insert_commitments(
        ref self: ContractState,
        commitments: Span<felt252>
    ) {
        only_authorized(@self);
        
        let mut i: u32 = 0;
        let len = commitments.len();
        
        loop {
            if i >= len {
                break;
            }
            
            let commitment = *commitments.at(i);
            self.insert_commitment(commitment);
            
            i += 1;
        };
    }

    // Update Merkle tree after inserting leaf
    fn update_tree(
        ref self: ContractState,
        leaf: felt252,
        leaf_index: u256
    ) -> felt252 {
        let mut current_hash = leaf;
        let mut current_index = leaf_index;
        
        // Traverse up the tree
        let mut level: u32 = TREE_DEPTH;
        loop {
            if level == 0 {
                break;
            }
            
            level -= 1;
            
            // Determine if current node is left or right child
            let is_right = (current_index % 2) == 1;
            
            let sibling = if is_right {
                // Get left sibling
                let sibling_index = current_index - 1;
                self.get_node_hash(sibling_index, level + 1)
            } else {
                // Get right sibling (or zero if doesn't exist)
                let sibling_index = current_index + 1;
                if sibling_index < self.next_leaf_index.read() {
                    self.get_node_hash(sibling_index, level + 1)
                } else {
                    self.zero_values.read(level + 1)
                }
            };
            
            // Hash current and sibling
            let mut data = ArrayTrait::new();
            if is_right {
                data.append(sibling);
                data.append(current_hash);
            } else {
                data.append(current_hash);
                data.append(sibling);
            }
            current_hash = poseidon_hash_span(data.span());
            
            // Update filled subtree for this level
            self.filled_subtrees.write(level, current_hash);
            
            // Move to parent
            current_index = current_index / 2;
        };
        
        // Update root
        let old_root = self.current_root.read();
        self.current_root.write(current_hash);
        
        // Store historical root
        let root_index = self.current_root_index.read();
        self.roots.write(root_index, current_hash);
        self.current_root_index.write(root_index + 1);
        
        self.emit(RootUpdated {
            old_root,
            new_root: current_hash,
            root_index,
        });
        
        current_hash
    }

    // Get node hash at specific index and level
    fn get_node_hash(
        self: @ContractState,
        index: u256,
        level: u32
    ) -> felt252 {
        if level == TREE_DEPTH {
            // Leaf level
            self.leaves.read(index)
        } else {
            // Internal node - use filled subtree or zero
            let filled = self.filled_subtrees.read(level);
            if filled != 0 {
                filled
            } else {
                self.zero_values.read(level)
            }
        }
    }

    // Verify Merkle proof
    #[external(v0)]
    fn verify_proof(
        self: @ContractState,
        leaf: felt252,
        leaf_index: u256,
        path: Span<felt252>,
        root: felt252
    ) -> bool {
        let mut current_hash = leaf;
        let mut current_index = leaf_index;
        
        let mut i: u32 = 0;
        let path_len = path.len();
        
        loop {
            if i >= path_len {
                break;
            }
            
            let sibling = *path.at(i);
            let is_right = (current_index % 2) == 1;
            
            let mut data = ArrayTrait::new();
            if is_right {
                data.append(sibling);
                data.append(current_hash);
            } else {
                data.append(current_hash);
                data.append(sibling);
            }
            current_hash = poseidon_hash_span(data.span());
            
            current_index = current_index / 2;
            i += 1;
        };
        
        current_hash == root
    }

    // Get Merkle proof for leaf (off-chain helper)
    #[external(v0)]
    fn get_proof(
        self: @ContractState,
        leaf_index: u256
    ) -> Span<felt252> {
        let mut proof = ArrayTrait::new();
        let mut current_index = leaf_index;
        
        let mut level: u32 = TREE_DEPTH;
        loop {
            if level == 0 {
                break;
            }
            
            level -= 1;
            
            let is_right = (current_index % 2) == 1;
            let sibling_index = if is_right {
                current_index - 1
            } else {
                current_index + 1
            };
            
            let sibling = self.get_node_hash(sibling_index, level + 1);
            proof.append(sibling);
            
            current_index = current_index / 2;
        };
        
        proof.span()
    }

    // Authorize inserter
    #[external(v0)]
    fn authorize_inserter(
        ref self: ContractState,
        inserter: ContractAddress
    ) {
        only_owner(@self);
        self.authorized_inserters.write(inserter, true);
        
        self.emit(InserterAuthorized { inserter });
    }

    // Revoke inserter
    #[external(v0)]
    fn revoke_inserter(
        ref self: ContractState,
        inserter: ContractAddress
    ) {
        only_owner(@self);
        self.authorized_inserters.write(inserter, false);
    }

    // Get current root
    #[external(v0)]
    fn get_current_root(self: @ContractState) -> felt252 {
        self.current_root.read()
    }

    // Get leaf count
    #[external(v0)]
    fn get_leaf_count(self: @ContractState) -> u256 {
        self.next_leaf_index.read()
    }

    // Get historical root
    #[external(v0)]
    fn get_historical_root(
        self: @ContractState,
        root_index: u256
    ) -> felt252 {
        self.roots.read(root_index)
    }

    // Check if root is valid (current or historical)
    #[external(v0)]
    fn is_known_root(
        self: @ContractState,
        root: felt252
    ) -> bool {
        // Check current root
        if root == self.current_root.read() {
            return true;
        }
        
        // Check historical roots
        let current_index = self.current_root_index.read();
        let mut i: u256 = 0;
        loop {
            if i >= current_index {
                break;
            }
            
            if self.roots.read(i) == root {
                return true;
            }
            
            i += 1;
        };
        
        false
    }
}


/**
 * Contract Configuration
 * Contains addresses and configuration for Starknet contracts
 * Requirements: 1.1
 */

// Network types
export type NetworkId = 'mainnet' | 'sepolia';

// Contract addresses interface
export interface ContractAddresses {
  pumpFactory: string;
  protocolConfig: string;
  quoteToken: string; // STRK or ETH
  stealthAddressGenerator: string;
  nullifierRegistry: string;
  zkProofVerifier: string;
}

// Full contract configuration
export interface ContractConfig {
  addresses: ContractAddresses;
  rpcUrl: string;
  explorerUrl: string;
  chainId: string;
}

// Sepolia testnet configuration
const SEPOLIA_CONFIG: ContractConfig = {
  addresses: {
    // These addresses should be updated after deployment
    pumpFactory: process.env.REACT_APP_PUMP_FACTORY_ADDRESS || '0x0',
    protocolConfig: process.env.REACT_APP_PROTOCOL_CONFIG_ADDRESS || '0x0',
    quoteToken: process.env.REACT_APP_QUOTE_TOKEN_ADDRESS || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', // STRK on Sepolia
    stealthAddressGenerator: process.env.REACT_APP_STEALTH_GENERATOR_ADDRESS || '0x0',
    nullifierRegistry: process.env.REACT_APP_NULLIFIER_REGISTRY_ADDRESS || '0x0',
    zkProofVerifier: process.env.REACT_APP_ZK_VERIFIER_ADDRESS || '0x0',
  },
  rpcUrl: process.env.REACT_APP_STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io',
  explorerUrl: 'https://sepolia.starkscan.co',
  chainId: 'SN_SEPOLIA',
};

// Mainnet configuration
const MAINNET_CONFIG: ContractConfig = {
  addresses: {
    pumpFactory: process.env.REACT_APP_PUMP_FACTORY_ADDRESS_MAINNET || '0x0',
    protocolConfig: process.env.REACT_APP_PROTOCOL_CONFIG_ADDRESS_MAINNET || '0x0',
    quoteToken: process.env.REACT_APP_QUOTE_TOKEN_ADDRESS_MAINNET || '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', // STRK on Mainnet
    stealthAddressGenerator: process.env.REACT_APP_STEALTH_GENERATOR_ADDRESS_MAINNET || '0x0',
    nullifierRegistry: process.env.REACT_APP_NULLIFIER_REGISTRY_ADDRESS_MAINNET || '0x0',
    zkProofVerifier: process.env.REACT_APP_ZK_VERIFIER_ADDRESS_MAINNET || '0x0',
  },
  rpcUrl: process.env.REACT_APP_STARKNET_RPC_URL_MAINNET || 'https://starknet-mainnet.public.blastapi.io',
  explorerUrl: 'https://starkscan.co',
  chainId: 'SN_MAIN',
};

// Network configurations map
const NETWORK_CONFIGS: Record<NetworkId, ContractConfig> = {
  mainnet: MAINNET_CONFIG,
  sepolia: SEPOLIA_CONFIG,
};

// Get current network from environment
export const getCurrentNetwork = (): NetworkId => {
  const network = process.env.REACT_APP_STARKNET_NETWORK as NetworkId;
  return network === 'mainnet' ? 'mainnet' : 'sepolia';
};

// Get contract configuration for current network
export const getContractConfig = (network?: NetworkId): ContractConfig => {
  const targetNetwork = network || getCurrentNetwork();
  return NETWORK_CONFIGS[targetNetwork];
};

// Get contract addresses for current network
export const getContractAddresses = (network?: NetworkId): ContractAddresses => {
  return getContractConfig(network).addresses;
};

// Validate contract address (non-zero)
export const isValidContractAddress = (address: string): boolean => {
  return address !== '0x0' && address !== '' && address.startsWith('0x');
};

// Export default configuration
export const CONTRACT_CONFIG = getContractConfig();
export const CONTRACT_ADDRESSES = getContractAddresses();

export default CONTRACT_CONFIG;

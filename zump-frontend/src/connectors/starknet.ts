/**
 * Starknet Connector Configuration
 * Configures wallet connectors for ArgentX, Braavos
 * Requirements: 1.1, 1.2
 */

import { mainnet, sepolia } from '@starknet-react/chains';
import { argent, braavos, publicProvider } from '@starknet-react/core';

// Supported chains configuration
export const supportedChains = [mainnet, sepolia];

// Default chain (Sepolia for development, mainnet for production)
export const defaultChain = process.env.NODE_ENV === 'production' ? mainnet : sepolia;

// Provider configuration
export const providers = [publicProvider()];

// Get connectors - using built-in argent and braavos
export const getConnectors = () => [
  argent(),
  braavos(),
];

// Chain configuration
export const chainConfig = {
  chains: supportedChains,
  defaultChainId: defaultChain.id,
};

// Export chain IDs for convenience
export const MAINNET_CHAIN_ID = mainnet.id;
export const SEPOLIA_CHAIN_ID = sepolia.id;

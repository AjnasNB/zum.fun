/**
 * Starknet Connector Configuration
 * Configures wallet connectors for ArgentX, Braavos, and WebWallet
 * Requirements: 1.1, 1.2
 */

import { mainnet, sepolia } from '@starknet-react/chains';
import { argent, braavos, useInjectedConnectors } from '@starknet-react/core';
import { WebWalletConnector } from 'starknetkit/webwallet';
import { ArgentMobileConnector } from 'starknetkit/argentMobile';
import { publicProvider } from '@starknet-react/core';

// Supported chains configuration
export const supportedChains = [mainnet, sepolia];

// Default chain (Sepolia for development, mainnet for production)
export const defaultChain = process.env.NODE_ENV === 'production' ? mainnet : sepolia;

// Argent WebWallet connector
export const webWalletConnector = new WebWalletConnector({
  url: 'https://web.argent.xyz',
});

// Argent Mobile connector
export const argentMobileConnector = new ArgentMobileConnector({
  dappName: 'Zump.fun',
  projectId: 'zump-fun-privacy-launchpad',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://zump.fun',
});

// Provider configuration
export const providers = [publicProvider()];

// Connector configuration for StarknetConfig
export const connectorConfig = {
  // Injected connectors (ArgentX, Braavos)
  injected: useInjectedConnectors,
  // Additional connectors
  connectors: [
    argent(),
    braavos(),
    webWalletConnector,
    argentMobileConnector,
  ],
};

// Chain configuration
export const chainConfig = {
  chains: supportedChains,
  defaultChainId: defaultChain.id,
};

// Export chain IDs for convenience
export const MAINNET_CHAIN_ID = mainnet.id;
export const SEPOLIA_CHAIN_ID = sepolia.id;

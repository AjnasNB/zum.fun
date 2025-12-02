/**
 * Starknet Provider Component
 * Wraps the application with StarknetConfig for wallet connectivity
 * Requirements: 1.2, 1.3
 */

import React, { ReactNode } from 'react';
import { StarknetConfig, publicProvider, argent, braavos } from '@starknet-react/core';
import { mainnet, sepolia } from '@starknet-react/chains';
import { WebWalletConnector } from 'starknetkit/webwallet';
import { ArgentMobileConnector } from 'starknetkit/argentMobile';

// Supported chains
const chains = [mainnet, sepolia];

// Provider function
const provider = publicProvider();

// WebWallet connector for browser-based wallet
const webWalletConnector = new WebWalletConnector({
  url: 'https://web.argent.xyz',
});

// Argent Mobile connector
const argentMobileConnector = new ArgentMobileConnector({
  dappName: 'Zump.fun',
  projectId: 'zump-fun-privacy-launchpad',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://zump.fun',
});

// All connectors: ArgentX, Braavos, WebWallet, Argent Mobile
const connectors = [
  argent(),
  braavos(),
  webWalletConnector,
  argentMobileConnector,
];

interface StarknetProviderProps {
  children: ReactNode;
}

export function StarknetProvider({ children }: StarknetProviderProps) {
  return (
    <StarknetConfig
      chains={chains}
      provider={provider}
      connectors={connectors}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}

export default StarknetProvider;

/**
 * Starknet Provider Component
 * Wraps the application with StarknetConfig for wallet connectivity
 * Requirements: 1.2, 1.3
 */

import React, { ReactNode } from 'react';
import { StarknetConfig, publicProvider, argent, braavos } from '@starknet-react/core';
import { mainnet, sepolia } from '@starknet-react/chains';

// Supported chains
const chains = [mainnet, sepolia];

// Provider function
const provider = publicProvider();

// Connectors: ArgentX, Braavos
const connectors = [
  argent(),
  braavos(),
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

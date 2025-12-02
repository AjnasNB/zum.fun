// Legacy Web3Modal - Now using StarknetProvider instead
// This file is kept for backward compatibility but functionality moved to StarknetProvider

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StarknetProvider } from '../providers/StarknetProvider';

// Setup queryClient
const queryClient = new QueryClient();

export function Web3ModalProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StarknetProvider>
        {children}
      </StarknetProvider>
    </QueryClientProvider>
  );
}

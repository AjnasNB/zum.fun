/**
 * useWallet Hook
 * Provides wallet connection state management for Starknet wallets
 * Requirements: 1.3, 1.4, 1.5
 */

import { useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core';
import { connect, disconnect as starknetkitDisconnect } from 'starknetkit';

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: bigint | undefined;
  connector: string | null;
  stealthAddresses: string[];
}

export interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  shortAddress: string | null;
}

/**
 * Custom hook for Starknet wallet connection management
 * Supports ArgentX, Braavos, and WebWallet
 */
export function useWallet(): UseWalletReturn {
  const { address, isConnected, chainId, connector, status } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const isConnecting = status === 'connecting' || status === 'reconnecting';

  // Format address for display (0x1234...5678)
  const shortAddress = useMemo(() => {
    if (!address) return null;
    const addr = address.toString();
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, [address]);

  // Connect wallet using StarknetKit modal
  const handleConnect = useCallback(async () => {
    try {
      const result = await connect({
        modalMode: 'alwaysAsk',
        modalTheme: 'dark',
        dappName: 'Zump.fun',
        projectId: 'zump-fun-privacy-launchpad',
      });

      if (result && result.connector) {
        // Find matching connector from starknet-react
        const matchingConnector = connectors.find(
          (c: { id?: string; name?: string }) => c.id === result.connector?.id || c.name === result.connector?.name
        );
        
        if (matchingConnector) {
          await connectAsync({ connector: matchingConnector });
        }
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, [connectAsync, connectors]);

  // Disconnect wallet and clear session
  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectAsync();
      await starknetkitDisconnect();
      // Clear any stored session data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('starknet_wallet_connected');
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }, [disconnectAsync]);

  return {
    address: address ? address.toString() : null,
    isConnected,
    isConnecting,
    chainId,
    connector: connector?.name || null,
    stealthAddresses: [], // Will be populated by stealth address generation feature
    shortAddress,
    connect: handleConnect,
    disconnect: handleDisconnect,
  };
}

export default useWallet;

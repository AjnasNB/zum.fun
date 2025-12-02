/**
 * useBalanceAggregation Hook
 * Aggregates balances across all stealth addresses
 * Requirements: 10.4
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import { StealthBalance, AggregatedBalance } from '../@types/privacy';
import { useStealthAddress } from './useStealthAddress';

// Storage key for cached balances
const BALANCE_CACHE_KEY = 'zump_balance_cache';

// Common tokens on Starknet
export const SUPPORTED_TOKENS = [
  {
    address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
  },
  {
    address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d',
    symbol: 'STRK',
    name: 'Starknet Token',
    decimals: 18,
  },
  {
    address: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
];

export interface UseBalanceAggregationReturn {
  stealthBalances: StealthBalance[];
  aggregatedBalances: AggregatedBalance[];
  totalValueUsd: string;
  isLoading: boolean;
  error: string | null;
  refreshBalances: () => Promise<void>;
  getBalanceForAddress: (address: string, token: string) => StealthBalance | undefined;
  getAggregatedBalance: (token: string) => AggregatedBalance | undefined;
}

/**
 * Custom hook for balance aggregation across stealth addresses
 */
export function useBalanceAggregation(): UseBalanceAggregationReturn {
  const { address: walletAddress, isConnected } = useAccount();
  const { stealthAddresses } = useStealthAddress();
  
  const [stealthBalances, setStealthBalances] = useState<StealthBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached balances on mount
  useEffect(() => {
    if (walletAddress && isConnected) {
      loadCachedBalances();
    } else {
      setStealthBalances([]);
    }
  }, [walletAddress, isConnected]);

  // Refresh balances when stealth addresses change
  useEffect(() => {
    if (stealthAddresses.length > 0 && isConnected) {
      refreshBalances();
    }
  }, [stealthAddresses.length, isConnected]);

  // Load cached balances from localStorage
  const loadCachedBalances = useCallback(() => {
    if (!walletAddress) return;
    
    try {
      const storageKey = `${BALANCE_CACHE_KEY}_${walletAddress}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as StealthBalance[];
        setStealthBalances(parsed);
      }
    } catch (err) {
      console.error('Failed to load cached balances:', err);
    }
  }, [walletAddress]);

  // Save balances to localStorage
  const saveCachedBalances = useCallback((balances: StealthBalance[]) => {
    if (!walletAddress) return;
    
    try {
      const storageKey = `${BALANCE_CACHE_KEY}_${walletAddress}`;
      localStorage.setItem(storageKey, JSON.stringify(balances));
    } catch (err) {
      console.error('Failed to save cached balances:', err);
    }
  }, [walletAddress]);

  // Aggregate balances by token
  const aggregatedBalances = useMemo((): AggregatedBalance[] => {
    const tokenMap = new Map<string, AggregatedBalance>();

    for (const balance of stealthBalances) {
      const existing = tokenMap.get(balance.token);
      
      if (existing) {
        // Add to existing aggregation
        const newTotal = addBigNumbers(existing.totalBalance, balance.balance);
        existing.totalBalance = newTotal;
        existing.formattedBalance = formatBalance(newTotal, getTokenDecimals(balance.tokenSymbol));
        existing.stealthBalances.push(balance);
      } else {
        // Create new aggregation
        tokenMap.set(balance.token, {
          token: balance.token,
          tokenSymbol: balance.tokenSymbol,
          totalBalance: balance.balance,
          formattedBalance: balance.formattedBalance,
          stealthBalances: [balance],
        });
      }
    }

    return Array.from(tokenMap.values());
  }, [stealthBalances]);

  // Calculate total value in USD (simplified - would need price oracle in production)
  const totalValueUsd = useMemo(() => {
    // Simplified calculation - in production, fetch prices from oracle
    let total = 0;
    for (const agg of aggregatedBalances) {
      const balance = parseFloat(agg.formattedBalance) || 0;
      // Mock prices for demo
      const prices: Record<string, number> = {
        ETH: 2000,
        STRK: 0.5,
        USDC: 1,
        USDT: 1,
      };
      total += balance * (prices[agg.tokenSymbol] || 0);
    }
    return total.toFixed(2);
  }, [aggregatedBalances]);

  // Refresh balances from blockchain
  const refreshBalances = useCallback(async () => {
    if (!isConnected || stealthAddresses.length === 0) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const newBalances: StealthBalance[] = [];

      // Fetch balances for each stealth address and token
      for (const stealth of stealthAddresses) {
        for (const token of SUPPORTED_TOKENS) {
          // In production, this would call the token contract's balanceOf
          // For now, generate mock balances for demo
          const mockBalance = generateMockBalance();
          
          if (mockBalance !== '0') {
            newBalances.push({
              address: stealth.address,
              token: token.address,
              tokenSymbol: token.symbol,
              balance: mockBalance,
              formattedBalance: formatBalance(mockBalance, token.decimals),
            });
          }
        }
      }

      setStealthBalances(newBalances);
      saveCachedBalances(newBalances);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to refresh balances';
      setError(errorMessage);
      console.error('Balance refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, stealthAddresses, saveCachedBalances]);

  // Get balance for specific address and token
  const getBalanceForAddress = useCallback((address: string, token: string): StealthBalance | undefined => {
    return stealthBalances.find(b => b.address === address && b.token === token);
  }, [stealthBalances]);

  // Get aggregated balance for specific token
  const getAggregatedBalance = useCallback((token: string): AggregatedBalance | undefined => {
    return aggregatedBalances.find(b => b.token === token);
  }, [aggregatedBalances]);

  return {
    stealthBalances,
    aggregatedBalances,
    totalValueUsd,
    isLoading,
    error,
    refreshBalances,
    getBalanceForAddress,
    getAggregatedBalance,
  };
}

// Helper: Add two big number strings
function addBigNumbers(a: string, b: string): string {
  const numA = BigInt(a || '0');
  const numB = BigInt(b || '0');
  return (numA + numB).toString();
}

// Helper: Format balance with decimals
function formatBalance(balance: string, decimals: number): string {
  const num = BigInt(balance || '0');
  const divisor = BigInt(10 ** decimals);
  const whole = num / divisor;
  const fraction = num % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  const trimmedFraction = fractionStr.replace(/0+$/, '').slice(0, 4);
  
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
}

// Helper: Get token decimals
function getTokenDecimals(symbol: string): number {
  const token = SUPPORTED_TOKENS.find(t => t.symbol === symbol);
  return token?.decimals || 18;
}

// Helper: Generate mock balance for demo
function generateMockBalance(): string {
  // 70% chance of having a balance
  if (Math.random() > 0.3) {
    const amount = Math.floor(Math.random() * 1000000000000000000); // Up to 1 token
    return amount.toString();
  }
  return '0';
}

export default useBalanceAggregation;

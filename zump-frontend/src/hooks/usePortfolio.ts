/**
 * usePortfolio Hook
 * Fetches user token balances and calculates portfolio value
 * Requirements: 9.1, 9.2, 9.4
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import { getContractService } from '../services/contractService';
import { getSupabaseService } from '../services/supabaseService';
import { TokenMetadata } from '../@types/supabase';
import { calculatePrice } from '../utils/bondingCurveUtils';

// ===========================================
// Types
// ===========================================

export interface TokenHolding {
  // Token info
  tokenAddress: string;
  poolAddress: string;
  name: string;
  symbol: string;
  imageUrl: string;
  
  // Balance info
  balance: bigint;
  currentPrice: bigint;
  value: bigint; // balance * currentPrice
  
  // Pool info
  basePrice: bigint;
  slope: bigint;
  tokensSold: bigint;
  maxSupply: bigint;
  progress: number;
  migrated: boolean;
}

export interface UsePortfolioOptions {
  autoFetch?: boolean;
  pollingInterval?: number; // in milliseconds, 0 to disable
}

export interface UsePortfolioReturn {
  holdings: TokenHolding[];
  totalValue: bigint;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isEmpty: boolean;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Calculate progress percentage
 */
const calculateProgress = (tokensSold: bigint, maxSupply: bigint): number => {
  if (maxSupply === BigInt(0)) return 0;
  const progress = Number((tokensSold * BigInt(10000)) / maxSupply) / 100;
  return Math.min(Math.max(progress, 0), 100);
};

/**
 * Calculate total portfolio value
 * Property 12: Portfolio Total Value Calculation
 * For any portfolio with multiple holdings, total value should equal
 * the sum of (balance × current_price) for each token.
 */
export const calculateTotalValue = (holdings: TokenHolding[]): bigint => {
  return holdings.reduce((sum, holding) => sum + holding.value, BigInt(0));
};

/**
 * Calculate holding value
 * Property 11: Portfolio Display Correctness
 * For any portfolio, each holding should display token name, balance,
 * and current value where value = balance × current_price.
 */
export const calculateHoldingValue = (balance: bigint, currentPrice: bigint): bigint => {
  return balance * currentPrice;
};

// ===========================================
// Default Metadata
// ===========================================

const createDefaultMetadata = (tokenAddress: string): Partial<TokenMetadata> => ({
  token_address: tokenAddress,
  name: 'Unknown Token',
  symbol: '???',
  description: null,
  image_url: null,
  creator_address: '0x0',
  tags: [],
});

// ===========================================
// Hook Implementation
// ===========================================

/**
 * Hook for fetching and managing user portfolio
 * 
 * Requirements:
 * - 9.1: Fetch balances for all tokens user holds
 * - 9.2: Display token name, balance, current value in quote token
 * - 9.4: Calculate total value using current bonding curve prices
 */
export function usePortfolio(options: UsePortfolioOptions = {}): UsePortfolioReturn {
  const { autoFetch = true, pollingInterval = 0 } = options;
  
  const { address, isConnected } = useAccount();
  
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address || !isConnected) {
      setHoldings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const contractService = getContractService();
      const supabaseService = getSupabaseService();

      // Get all launches to check balances
      const launches = await contractService.getAllLaunches();

      if (launches.length === 0) {
        setHoldings([]);
        return;
      }

      // Fetch balances for all tokens in parallel
      const balancePromises = launches.map(async (launch) => {
        try {
          const balance = await contractService.getBalance(launch.token, address);
          return { launch, balance };
        } catch (err) {
          console.error(`Failed to fetch balance for ${launch.token}:`, err);
          return { launch, balance: BigInt(0) };
        }
      });

      const balanceResults = await Promise.all(balancePromises);

      // Filter to only tokens with non-zero balance
      const tokensWithBalance = balanceResults.filter(
        ({ balance }) => balance > BigInt(0)
      );

      if (tokensWithBalance.length === 0) {
        setHoldings([]);
        return;
      }

      // Fetch pool states for tokens with balance
      const poolStatePromises = tokensWithBalance.map(async ({ launch, balance }) => {
        try {
          const state = await contractService.getPoolState(launch.pool);
          return { launch, balance, state };
        } catch (err) {
          console.error(`Failed to fetch pool state for ${launch.pool}:`, err);
          return { launch, balance, state: null };
        }
      });

      const poolResults = await Promise.all(poolStatePromises);

      // Fetch metadata from Supabase
      const tokenAddresses = tokensWithBalance.map(({ launch }) => launch.token);
      let metadataMap: Map<string, TokenMetadata> = new Map();

      try {
        const metadataList = await supabaseService.getTokenMetadataByAddresses(tokenAddresses);
        metadataMap = new Map(metadataList.map((m) => [m.token_address, m]));
      } catch (err) {
        console.warn('Failed to fetch metadata from Supabase:', err);
      }

      // Build holdings array
      const portfolioHoldings: TokenHolding[] = poolResults
        .filter(({ state }) => state !== null)
        .map(({ launch, balance, state }) => {
          const metadata = metadataMap.get(launch.token) || createDefaultMetadata(launch.token);
          const poolState = state!;

          // Calculate current price using bonding curve formula
          const currentPrice = calculatePrice(launch.basePrice, launch.slope, poolState.tokensSold);
          
          // Calculate holding value: balance × currentPrice
          const value = calculateHoldingValue(balance, currentPrice);
          
          // Calculate progress
          const progress = calculateProgress(poolState.tokensSold, launch.maxSupply);

          return {
            tokenAddress: launch.token,
            poolAddress: launch.pool,
            name: metadata.name || launch.name || 'Unknown Token',
            symbol: metadata.symbol || launch.symbol || '???',
            imageUrl: metadata.image_url || '',
            balance,
            currentPrice,
            value,
            basePrice: launch.basePrice,
            slope: launch.slope,
            tokensSold: poolState.tokensSold,
            maxSupply: launch.maxSupply,
            progress,
            migrated: poolState.migrated || launch.migrated,
          };
        });

      // Sort by value (highest first)
      portfolioHoldings.sort((a, b) => {
        if (a.value > b.value) return -1;
        if (a.value < b.value) return 1;
        return 0;
      });

      setHoldings(portfolioHoldings);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch portfolio'));
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  // Calculate total value
  const totalValue = useMemo(() => calculateTotalValue(holdings), [holdings]);

  // Check if portfolio is empty
  const isEmpty = useMemo(() => holdings.length === 0, [holdings]);

  // Auto-fetch on mount and when address changes
  useEffect(() => {
    if (autoFetch && isConnected && address) {
      fetchPortfolio();
    }
  }, [autoFetch, isConnected, address, fetchPortfolio]);

  // Clear holdings when disconnected
  useEffect(() => {
    if (!isConnected || !address) {
      setHoldings([]);
    }
  }, [isConnected, address]);

  // Polling for updates (subtask 11.3)
  useEffect(() => {
    if (pollingInterval > 0 && isConnected && address) {
      const interval = setInterval(fetchPortfolio, pollingInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [pollingInterval, isConnected, address, fetchPortfolio]);

  return {
    holdings,
    totalValue,
    isLoading,
    error,
    refetch: fetchPortfolio,
    isEmpty,
  };
}

export default usePortfolio;

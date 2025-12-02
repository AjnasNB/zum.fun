/**
 * useTokenDetail Hook
 * Fetches token detail with on-chain pool state data
 * Requirements: 4.1, 4.2, 4.3
 */

import { useState, useEffect, useCallback } from 'react';
import { getContractService, PoolState, PoolConfig } from '../services/contractService';
import { getSupabaseService } from '../services/supabaseService';
import { TokenMetadata } from '../@types/supabase';
import { calculatePrice, calculateProgress, calculateMarketCap } from '../utils/bondingCurveUtils';

// ===========================================
// Types
// ===========================================

export interface TokenDetail {
  // On-chain data
  tokenAddress: string;
  poolAddress: string;
  quoteToken: string;
  currentPrice: bigint;
  tokensSold: bigint;
  maxSupply: bigint;
  reserveBalance: bigint;
  migrated: boolean;
  basePrice: bigint;
  slope: bigint;
  
  // Off-chain metadata
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  creatorAddress: string;
  createdAt: Date;
  tags: string[];
  
  // Calculated
  marketCap: bigint;
  progress: number; // 0-100
}

export interface UseTokenDetailOptions {
  autoFetch?: boolean;
  pollingInterval?: number; // in milliseconds, 0 to disable
}

export interface UseTokenDetailReturn {
  token: TokenDetail | null;
  poolState: PoolState | null;
  poolConfig: PoolConfig | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

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
 * Hook to fetch token detail with on-chain pool state
 * 
 * Requirements:
 * - 4.1: Fetch pool state from BondingCurvePool.get_state
 * - 4.2: Calculate current price from bonding curve formula
 * - 4.3: Calculate progress percentage
 * 
 * @param tokenAddress - The token contract address
 * @param poolAddress - The bonding curve pool address
 * @param options - Hook options
 */
export function useTokenDetail(
  tokenAddress: string | undefined,
  poolAddress: string | undefined,
  options: UseTokenDetailOptions = {}
): UseTokenDetailReturn {
  const { autoFetch = true, pollingInterval = 0 } = options;
  
  const [token, setToken] = useState<TokenDetail | null>(null);
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [poolConfig, setPoolConfig] = useState<PoolConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTokenDetail = useCallback(async () => {
    if (!tokenAddress || !poolAddress) {
      setToken(null);
      setPoolState(null);
      setPoolConfig(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const contractService = getContractService();
      const supabaseService = getSupabaseService();
      
      // Fetch pool state and config in parallel
      // Requirements: 4.1 - Fetch pool state from BondingCurvePool.get_state
      const [state, config] = await Promise.all([
        contractService.getPoolState(poolAddress),
        contractService.getPoolConfig(poolAddress),
      ]);
      
      setPoolState(state);
      setPoolConfig(config);
      
      // Fetch metadata from Supabase
      let metadata: TokenMetadata | Partial<TokenMetadata>;
      try {
        const fetchedMetadata = await supabaseService.getTokenMetadata(tokenAddress);
        metadata = fetchedMetadata || createDefaultMetadata(tokenAddress);
      } catch (err) {
        console.warn('Failed to fetch metadata from Supabase:', err);
        metadata = createDefaultMetadata(tokenAddress);
      }
      
      // Calculate current price from bonding curve formula
      // Requirements: 4.2 - price = base_price + (slope × tokens_sold)
      const currentPrice = calculatePrice(config.basePrice, config.slope, state.tokensSold);
      
      // Calculate progress percentage
      // Requirements: 4.3 - progress = (tokens_sold / max_supply) × 100
      const progress = calculateProgress(state.tokensSold, config.maxSupply);
      
      // Calculate market cap
      const marketCap = calculateMarketCap(currentPrice, state.tokensSold);
      
      const tokenDetail: TokenDetail = {
        // On-chain data
        tokenAddress,
        poolAddress,
        quoteToken: state.quoteToken,
        currentPrice,
        tokensSold: state.tokensSold,
        maxSupply: config.maxSupply,
        reserveBalance: state.reserveBalance,
        migrated: state.migrated,
        basePrice: config.basePrice,
        slope: config.slope,
        
        // Off-chain metadata
        name: metadata.name || 'Unknown Token',
        symbol: metadata.symbol || '???',
        description: metadata.description || '',
        imageUrl: metadata.image_url || '',
        creatorAddress: metadata.creator_address || '0x0',
        createdAt: metadata.created_at ? new Date(metadata.created_at) : new Date(),
        tags: metadata.tags || [],
        
        // Calculated
        marketCap,
        progress,
      };
      
      setToken(tokenDetail);
    } catch (err) {
      console.error('Failed to fetch token detail:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch token detail'));
    } finally {
      setIsLoading(false);
    }
  }, [tokenAddress, poolAddress]);

  // Auto-fetch on mount and when addresses change
  useEffect(() => {
    if (autoFetch && tokenAddress && poolAddress) {
      fetchTokenDetail();
    }
  }, [autoFetch, tokenAddress, poolAddress, fetchTokenDetail]);

  // Polling for updates
  useEffect(() => {
    if (pollingInterval > 0 && tokenAddress && poolAddress) {
      const interval = setInterval(fetchTokenDetail, pollingInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [pollingInterval, tokenAddress, poolAddress, fetchTokenDetail]);

  return {
    token,
    poolState,
    poolConfig,
    isLoading,
    error,
    refetch: fetchTokenDetail,
  };
}

export default useTokenDetail;

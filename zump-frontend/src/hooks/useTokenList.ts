/**
 * useTokenList Hook
 * Fetches all token launches from PumpFactory and joins with Supabase metadata
 * Requirements: 3.1, 3.3, 3.4
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getContractService, PublicLaunchInfo, PoolState } from '../services/contractService';
import { getSupabaseService } from '../services/supabaseService';
import { TokenMetadata } from '../@types/supabase';

// ===========================================
// Types
// ===========================================

export interface TokenWithMetadata {
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
  createdAt: bigint;
  
  // Off-chain metadata
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  creatorAddress: string;
  createdAtDate: Date;
  tags: string[];
  
  // Calculated
  marketCap: bigint;
  progress: number; // 0-100
}

export type SortField = 'price' | 'marketCap' | 'createdAt' | 'progress' | 'name';
export type SortDirection = 'asc' | 'desc';

export interface UseTokenListOptions {
  autoFetch?: boolean;
  pollingInterval?: number; // in milliseconds, 0 to disable
}

export interface UseTokenListReturn {
  tokens: TokenWithMetadata[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  sortBy: (field: SortField, direction: SortDirection) => void;
  currentSort: { field: SortField; direction: SortDirection };
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Calculate current price from bonding curve formula
 * price = base_price + (slope × tokens_sold)
 */
export const calculatePrice = (basePrice: bigint, slope: bigint, tokensSold: bigint): bigint => {
  return basePrice + slope * tokensSold;
};

/**
 * Calculate progress percentage
 * progress = (tokens_sold / max_supply) × 100
 */
export const calculateProgress = (tokensSold: bigint, maxSupply: bigint): number => {
  if (maxSupply === BigInt(0)) return 0;
  const progress = Number((tokensSold * BigInt(10000)) / maxSupply) / 100;
  return Math.min(Math.max(progress, 0), 100);
};

/**
 * Calculate market cap
 * marketCap = current_price × tokens_sold
 */
export const calculateMarketCap = (currentPrice: bigint, tokensSold: bigint): bigint => {
  return currentPrice * tokensSold;
};

/**
 * Sort tokens by field
 */
export const sortTokens = (
  tokens: TokenWithMetadata[],
  field: SortField,
  direction: SortDirection
): TokenWithMetadata[] => {
  const sorted = [...tokens].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case 'price':
        comparison = a.currentPrice > b.currentPrice ? 1 : a.currentPrice < b.currentPrice ? -1 : 0;
        break;
      case 'marketCap':
        comparison = a.marketCap > b.marketCap ? 1 : a.marketCap < b.marketCap ? -1 : 0;
        break;
      case 'createdAt':
        comparison = a.createdAt > b.createdAt ? 1 : a.createdAt < b.createdAt ? -1 : 0;
        break;
      case 'progress':
        comparison = a.progress - b.progress;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      default:
        comparison = 0;
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
};

// ===========================================
// Default Metadata
// ===========================================

const createDefaultMetadata = (launch: PublicLaunchInfo): Partial<TokenMetadata> => ({
  token_address: launch.token,
  name: launch.name || 'Unknown Token',
  symbol: launch.symbol || '???',
  description: null,
  image_url: null,
  creator_address: '0x0',
  tags: [],
});

// ===========================================
// Hook Implementation
// ===========================================

export function useTokenList(options: UseTokenListOptions = {}): UseTokenListReturn {
  const { autoFetch = true, pollingInterval = 0 } = options;
  
  const [tokens, setTokens] = useState<TokenWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sortConfig, setSortConfig] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'createdAt',
    direction: 'desc',
  });

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const contractService = getContractService();
      const supabaseService = getSupabaseService();
      
      // Fetch all launches from PumpFactory
      const launches = await contractService.getAllLaunches();
      
      if (launches.length === 0) {
        setTokens([]);
        return;
      }
      
      // Fetch pool states for each launch
      const poolStatesPromises = launches.map(async (launch) => {
        try {
          const state = await contractService.getPoolState(launch.pool);
          return { launch, state };
        } catch (err) {
          console.error(`Failed to fetch pool state for ${launch.pool}:`, err);
          return { launch, state: null };
        }
      });
      
      const launchesWithStates = await Promise.all(poolStatesPromises);
      
      // Fetch metadata from Supabase
      const tokenAddresses = launches.map((l) => l.token);
      let metadataMap: Map<string, TokenMetadata> = new Map();
      
      try {
        const metadataList = await supabaseService.getTokenMetadataByAddresses(tokenAddresses);
        metadataMap = new Map(metadataList.map((m) => [m.token_address, m]));
      } catch (err) {
        console.warn('Failed to fetch metadata from Supabase:', err);
      }
      
      // Combine on-chain data with metadata
      const tokensWithMetadata: TokenWithMetadata[] = launchesWithStates
        .filter(({ state }) => state !== null)
        .map(({ launch, state }) => {
          const metadata = metadataMap.get(launch.token) || createDefaultMetadata(launch);
          const poolState = state as PoolState;
          
          const currentPrice = calculatePrice(launch.basePrice, launch.slope, poolState.tokensSold);
          const progress = calculateProgress(poolState.tokensSold, launch.maxSupply);
          const marketCap = calculateMarketCap(currentPrice, poolState.tokensSold);
          
          return {
            // On-chain data
            tokenAddress: launch.token,
            poolAddress: launch.pool,
            quoteToken: launch.quoteToken,
            currentPrice,
            tokensSold: poolState.tokensSold,
            maxSupply: launch.maxSupply,
            reserveBalance: poolState.reserveBalance,
            migrated: poolState.migrated || launch.migrated,
            basePrice: launch.basePrice,
            slope: launch.slope,
            createdAt: launch.createdAt,
            
            // Off-chain metadata
            name: metadata.name || launch.name || 'Unknown Token',
            symbol: metadata.symbol || launch.symbol || '???',
            description: metadata.description || '',
            imageUrl: metadata.image_url || '',
            creatorAddress: metadata.creator_address || '0x0',
            createdAtDate: metadata.created_at ? new Date(metadata.created_at) : new Date(Number(launch.createdAt) * 1000),
            tags: metadata.tags || [],
            
            // Calculated
            marketCap,
            progress,
          };
        });
      
      setTokens(tokensWithMetadata);
    } catch (err) {
      console.error('Failed to fetch token list:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch token list'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sort function
  const sortBy = useCallback((field: SortField, direction: SortDirection) => {
    setSortConfig({ field, direction });
  }, []);

  // Sorted tokens
  const sortedTokens = useMemo(() => {
    return sortTokens(tokens, sortConfig.field, sortConfig.direction);
  }, [tokens, sortConfig]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchTokens();
    }
  }, [autoFetch, fetchTokens]);

  // Polling for updates
  useEffect(() => {
    if (pollingInterval > 0) {
      const interval = setInterval(fetchTokens, pollingInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [pollingInterval, fetchTokens]);

  return {
    tokens: sortedTokens,
    isLoading,
    error,
    refetch: fetchTokens,
    sortBy,
    currentSort: sortConfig,
  };
}

export default useTokenList;

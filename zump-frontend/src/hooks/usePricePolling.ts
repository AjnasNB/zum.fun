/**
 * usePricePolling Hook
 * Polls BondingCurvePool for real-time price updates
 * Requirements: 10.1, 10.5
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getContractService, PoolState, PoolConfig } from '../services/contractService';
import { calculatePrice } from '../utils/bondingCurveUtils';

// ===========================================
// Types
// ===========================================

export type PriceChangeDirection = 'up' | 'down' | 'unchanged';

export interface PriceData {
  currentPrice: bigint;
  previousPrice: bigint | null;
  changeDirection: PriceChangeDirection;
  changeAmount: bigint;
  changePercentage: number;
  tokensSold: bigint;
  lastUpdated: Date;
}

export interface UsePricePollingOptions {
  poolAddress: string;
  pollingInterval?: number; // in milliseconds, default 10000 (10 seconds)
  enabled?: boolean;
}

export interface UsePricePollingReturn {
  priceData: PriceData | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  lastError: Error | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  
  // Actions
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

// ===========================================
// Constants
// ===========================================

const DEFAULT_POLLING_INTERVAL = 10000; // 10 seconds as per Requirements 10.1
const STALE_THRESHOLD = 30000; // 30 seconds - data is considered stale
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

// ===========================================
// Helper Functions
// ===========================================

/**
 * Calculate price change direction
 */
function getPriceChangeDirection(
  currentPrice: bigint,
  previousPrice: bigint | null
): PriceChangeDirection {
  if (previousPrice === null) return 'unchanged';
  if (currentPrice > previousPrice) return 'up';
  if (currentPrice < previousPrice) return 'down';
  return 'unchanged';
}

/**
 * Calculate price change percentage
 */
function calculateChangePercentage(
  currentPrice: bigint,
  previousPrice: bigint | null
): number {
  if (previousPrice === null || previousPrice === BigInt(0)) return 0;
  
  const change = currentPrice - previousPrice;
  // Multiply by 10000 for 2 decimal precision, then divide by 100
  const percentageScaled = (change * BigInt(10000)) / previousPrice;
  return Number(percentageScaled) / 100;
}

// ===========================================
// Hook Implementation
// ===========================================

/**
 * Hook for polling bonding curve pool prices
 * 
 * Requirements:
 * - 10.1: Poll BondingCurvePool every 10 seconds
 * - 10.5: Handle connection errors gracefully
 * 
 * @param options - Hook options including pool address and polling interval
 */
export function usePricePolling(options: UsePricePollingOptions): UsePricePollingReturn {
  const { 
    poolAddress, 
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true 
  } = options;
  
  // State
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  
  // Refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const lastUpdateRef = useRef<Date | null>(null);
  const previousPriceRef = useRef<bigint | null>(null);
  const isPollingRef = useRef(false);
  
  // Services
  const contractService = useMemo(() => getContractService(), []);

  /**
   * Check if data is stale
   */
  const isStale = useMemo(() => {
    if (!lastUpdateRef.current) return true;
    const timeSinceUpdate = Date.now() - lastUpdateRef.current.getTime();
    return timeSinceUpdate > STALE_THRESHOLD;
  }, [priceData]); // Re-evaluate when priceData changes

  /**
   * Fetch current price from pool
   * Requirements: 10.1
   */
  const fetchPrice = useCallback(async (): Promise<void> => {
    if (!poolAddress) return;
    
    setIsLoading(true);
    
    try {
      // Fetch pool state and config
      const [state, config] = await Promise.all([
        contractService.getPoolState(poolAddress),
        contractService.getPoolConfig(poolAddress),
      ]);
      
      // Calculate current price using bonding curve formula
      const currentPrice = calculatePrice(config.basePrice, config.slope, state.tokensSold);
      const previousPrice = previousPriceRef.current;
      
      // Calculate change metrics
      const changeDirection = getPriceChangeDirection(currentPrice, previousPrice);
      const changeAmount = previousPrice !== null 
        ? (currentPrice > previousPrice ? currentPrice - previousPrice : previousPrice - currentPrice)
        : BigInt(0);
      const changePercentage = calculateChangePercentage(currentPrice, previousPrice);
      
      const now = new Date();
      
      // Update price data
      setPriceData({
        currentPrice,
        previousPrice,
        changeDirection,
        changeAmount,
        changePercentage,
        tokensSold: state.tokensSold,
        lastUpdated: now,
      });
      
      // Update refs
      previousPriceRef.current = currentPrice;
      lastUpdateRef.current = now;
      
      // Reset error state on success
      setError(null);
      retryCountRef.current = 0;
      setConnectionStatus('connected');
      
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch price');
      setError(fetchError);
      setLastError(fetchError);
      
      // Handle connection errors gracefully
      // Requirements: 10.5
      if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        retryCountRef.current += 1;
        setConnectionStatus('reconnecting');
        
        // Schedule retry
        setTimeout(() => {
          if (isPollingRef.current) {
            fetchPrice();
          }
        }, RETRY_DELAY);
      } else {
        setConnectionStatus('disconnected');
        console.error('Price polling failed after max retries:', fetchError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [poolAddress, contractService]);

  /**
   * Start polling for price updates
   * Requirements: 10.1
   */
  const startPolling = useCallback(() => {
    if (isPollingRef.current || !poolAddress) return;
    
    isPollingRef.current = true;
    
    // Initial fetch
    fetchPrice();
    
    // Set up polling interval
    pollingRef.current = setInterval(() => {
      if (isPollingRef.current) {
        fetchPrice();
      }
    }, pollingInterval);
  }, [poolAddress, pollingInterval, fetchPrice]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    isPollingRef.current = false;
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /**
   * Manual refresh
   */
  const refresh = useCallback(async (): Promise<void> => {
    retryCountRef.current = 0;
    await fetchPrice();
  }, [fetchPrice]);

  // Auto-start polling when enabled and pool address is provided
  useEffect(() => {
    if (enabled && poolAddress) {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [enabled, poolAddress, startPolling, stopPolling]);

  // Update polling interval if it changes
  useEffect(() => {
    if (isPollingRef.current && pollingRef.current) {
      // Restart polling with new interval
      stopPolling();
      startPolling();
    }
  }, [pollingInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    priceData,
    isLoading,
    isStale,
    error,
    lastError,
    connectionStatus,
    refresh,
    startPolling,
    stopPolling,
  };
}

export default usePricePolling;

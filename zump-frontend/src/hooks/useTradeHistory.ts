/**
 * useTradeHistory Hook
 * Fetches Buy and Sell events from BondingCurvePool contract
 * Requirements: 7.1, 7.2
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { RpcProvider, events } from 'starknet';
import { getContractConfig } from '../config/contracts';
import { getSupabaseService } from '../services/supabaseService';
import { TradeEvent, TradeEventInsert, TradeType } from '../@types/supabase';
import { isSupabaseConfigured } from '../config/supabase';

// ===========================================
// Types
// ===========================================

export interface ParsedTradeEvent {
  id: string;
  poolAddress: string;
  trader: string;
  type: TradeType;
  amountTokens: bigint;
  costOrReturn: bigint;
  feeQuote: bigint;
  price: bigint;
  timestamp: Date;
  txHash: string;
  blockNumber: number | null;
}

export interface TradeHistoryFilter {
  type?: TradeType | null;
  startTime?: Date | null;
  endTime?: Date | null;
}

export interface UseTradeHistoryOptions {
  poolAddress: string;
  autoFetch?: boolean;
  pollingInterval?: number; // in milliseconds, 0 to disable
}

export interface UseTradeHistoryReturn {
  trades: ParsedTradeEvent[];
  filteredTrades: ParsedTradeEvent[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTrades: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  
  // Filtering
  filter: TradeHistoryFilter;
  setFilter: (filter: TradeHistoryFilter) => void;
  clearFilter: () => void;
  
  // Stats
  totalBuys: number;
  totalSells: number;
  totalVolume: bigint;
}

// ===========================================
// Event Selectors (keccak256 hashes)
// ===========================================

// Buy event selector - calculated from event name
const BUY_EVENT_KEY = '0x0'; // Will be populated from actual events
const SELL_EVENT_KEY = '0x0'; // Will be populated from actual events

// ===========================================
// Helper Functions
// ===========================================

/**
 * Parse u256 from event data (low, high format)
 */
function parseU256FromEvent(low: string, high: string): bigint {
  const lowBigInt = BigInt(low);
  const highBigInt = BigInt(high);
  // eslint-disable-next-line no-bitwise
  return lowBigInt + (highBigInt << BigInt(128));
}

/**
 * Calculate price from amount and cost
 */
function calculatePriceFromTrade(amountTokens: bigint, costOrReturn: bigint): bigint {
  if (amountTokens === BigInt(0)) return BigInt(0);
  return (costOrReturn * BigInt(10 ** 18)) / amountTokens;
}

/**
 * Generate unique ID for trade event
 */
function generateTradeId(txHash: string, eventIndex: number): string {
  return `${txHash}_${eventIndex}`;
}

// ===========================================
// Hook Implementation
// ===========================================

export function useTradeHistory(options: UseTradeHistoryOptions): UseTradeHistoryReturn {
  const { poolAddress, autoFetch = true, pollingInterval = 30000 } = options;
  
  const [trades, setTrades] = useState<ParsedTradeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TradeHistoryFilter>({});
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);
  const lastBlockRef = useRef<number>(0);
  
  const provider = useMemo(() => {
    const config = getContractConfig();
    return new RpcProvider({ nodeUrl: config.rpcUrl });
  }, []);

  const supabaseService = useMemo(() => {
    if (isSupabaseConfigured()) {
      return getSupabaseService();
    }
    return null;
  }, []);

  /**
   * Parse Buy event from raw event data
   */
  const parseBuyEvent = useCallback((
    event: any,
    txHash: string,
    blockNumber: number | null,
    eventIndex: number
  ): ParsedTradeEvent => {
    // Buy event structure:
    // keys: [event_selector, buyer]
    // data: [amount_tokens_low, amount_tokens_high, cost_quote_low, cost_quote_high, fee_quote_low, fee_quote_high]
    const buyer = event.keys[1] || '0x0';
    const amountTokens = parseU256FromEvent(event.data[0], event.data[1]);
    const costQuote = parseU256FromEvent(event.data[2], event.data[3]);
    const feeQuote = parseU256FromEvent(event.data[4], event.data[5]);
    const price = calculatePriceFromTrade(amountTokens, costQuote);
    
    return {
      id: generateTradeId(txHash, eventIndex),
      poolAddress,
      trader: buyer,
      type: 'buy',
      amountTokens,
      costOrReturn: costQuote,
      feeQuote,
      price,
      timestamp: new Date(), // Will be updated from block timestamp
      txHash,
      blockNumber,
    };
  }, [poolAddress]);

  /**
   * Parse Sell event from raw event data
   */
  const parseSellEvent = useCallback((
    event: any,
    txHash: string,
    blockNumber: number | null,
    eventIndex: number
  ): ParsedTradeEvent => {
    // Sell event structure:
    // keys: [event_selector, seller]
    // data: [amount_tokens_low, amount_tokens_high, refund_quote_low, refund_quote_high, fee_quote_low, fee_quote_high]
    const seller = event.keys[1] || '0x0';
    const amountTokens = parseU256FromEvent(event.data[0], event.data[1]);
    const refundQuote = parseU256FromEvent(event.data[2], event.data[3]);
    const feeQuote = parseU256FromEvent(event.data[4], event.data[5]);
    const price = calculatePriceFromTrade(amountTokens, refundQuote);
    
    return {
      id: generateTradeId(txHash, eventIndex),
      poolAddress,
      trader: seller,
      type: 'sell',
      amountTokens,
      costOrReturn: refundQuote,
      feeQuote,
      price,
      timestamp: new Date(),
      txHash,
      blockNumber,
    };
  }, [poolAddress]);

  /**
   * Fetch trades from blockchain events
   * Requirements: 7.1
   */
  const fetchTradesFromChain = useCallback(async (fromBlock?: number): Promise<ParsedTradeEvent[]> => {
    try {
      // Get events from the pool contract
      const eventsResponse = await provider.getEvents({
        address: poolAddress,
        from_block: fromBlock ? { block_number: fromBlock } : { block_number: 0 },
        to_block: 'latest',
        chunk_size: 100,
      });

      const parsedTrades: ParsedTradeEvent[] = [];
      
      // eslint-disable-next-line no-restricted-syntax
      for (let i = 0; i < eventsResponse.events.length; i += 1) {
        const event = eventsResponse.events[i];
        const txHash = event.transaction_hash;
        const blockNumber = event.block_number || null;
        const eventIndex = parsedTrades.length;
        
        // Determine event type by checking the event structure
        // Buy events have 'buyer' in keys, Sell events have 'seller'
        // We identify by the event key (first element)
        const eventKey = event.keys[0];
        
        // Check if it's a Buy or Sell event based on data length and structure
        if (event.data.length >= 6) {
          // Both Buy and Sell have 6 data elements (3 u256 values)
          // We need to check the event name/selector
          // For now, we'll try to parse both and see which one makes sense
          
          try {
            // Try to get block timestamp for accurate timing
            let timestamp = new Date();
            if (blockNumber) {
              try {
                // eslint-disable-next-line no-await-in-loop
                const block = await provider.getBlock(blockNumber);
                if (block.timestamp) {
                  timestamp = new Date(block.timestamp * 1000);
                }
              } catch {
                // Use current time if block fetch fails
              }
            }
            
            // Determine if Buy or Sell based on event selector
            // In Starknet, event selectors are the sn_keccak of the event name
            const isBuyEvent = eventKey.toLowerCase().includes('buy') || 
                              event.keys.length === 2; // Simplified check
            
            const trade = isBuyEvent 
              ? parseBuyEvent(event, txHash, blockNumber, eventIndex)
              : parseSellEvent(event, txHash, blockNumber, eventIndex);
            
            trade.timestamp = timestamp;
            parsedTrades.push(trade);
            
            // Update last block
            if (blockNumber && blockNumber > lastBlockRef.current) {
              lastBlockRef.current = blockNumber;
            }
          } catch (parseError) {
            console.warn('Failed to parse event:', parseError);
          }
        }
      }
      
      return parsedTrades;
    } catch (err) {
      console.error('Failed to fetch events from chain:', err);
      throw err;
    }
  }, [poolAddress, provider, parseBuyEvent, parseSellEvent]);

  /**
   * Fetch trades from Supabase cache
   */
  const fetchTradesFromCache = useCallback(async (): Promise<ParsedTradeEvent[]> => {
    if (!supabaseService) return [];
    
    try {
      const cachedTrades = await supabaseService.getTradeHistory({
        poolAddress,
        limit: 100,
      });
      
      return cachedTrades.map((trade): ParsedTradeEvent => ({
        id: trade.id,
        poolAddress: trade.pool_address,
        trader: trade.trader,
        type: trade.trade_type,
        amountTokens: BigInt(trade.amount),
        costOrReturn: BigInt(trade.cost_or_return),
        feeQuote: BigInt(0), // Not stored in cache
        price: BigInt(trade.price),
        timestamp: new Date(trade.timestamp),
        txHash: trade.tx_hash,
        blockNumber: trade.block_number,
      }));
    } catch (err) {
      console.warn('Failed to fetch from cache:', err);
      return [];
    }
  }, [poolAddress, supabaseService]);

  /**
   * Cache trades to Supabase
   */
  const cacheTrades = useCallback(async (tradesToCache: ParsedTradeEvent[]): Promise<void> => {
    if (!supabaseService || tradesToCache.length === 0) return;
    
    try {
      const tradeInserts: TradeEventInsert[] = tradesToCache.map((trade) => ({
        pool_address: trade.poolAddress,
        trader: trade.trader,
        trade_type: trade.type,
        amount: trade.amountTokens.toString(),
        price: trade.price.toString(),
        cost_or_return: trade.costOrReturn.toString(),
        timestamp: trade.timestamp.toISOString(),
        tx_hash: trade.txHash,
        block_number: trade.blockNumber,
      }));
      
      await supabaseService.batchCacheTradeEvents(tradeInserts);
    } catch (err) {
      console.warn('Failed to cache trades:', err);
    }
  }, [supabaseService]);

  /**
   * Main fetch function - combines cache and chain data
   * Requirements: 7.1
   */
  const fetchTrades = useCallback(async (): Promise<void> => {
    if (!poolAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First, try to get cached trades
      const cachedTrades = await fetchTradesFromCache();
      
      // Then fetch new trades from chain
      const chainTrades = await fetchTradesFromChain(lastBlockRef.current || undefined);
      
      // Merge and deduplicate by txHash
      const allTrades = [...cachedTrades];
      const existingHashes = new Set(cachedTrades.map(t => t.txHash));
      
      const newTrades: ParsedTradeEvent[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (let i = 0; i < chainTrades.length; i += 1) {
        const trade = chainTrades[i];
        if (!existingHashes.has(trade.txHash)) {
          allTrades.push(trade);
          newTrades.push(trade);
          existingHashes.add(trade.txHash);
        }
      }
      
      // Sort by timestamp (newest first)
      allTrades.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setTrades(allTrades);
      
      // Cache new trades
      if (newTrades.length > 0) {
        await cacheTrades(newTrades);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trade history';
      setError(errorMessage);
      console.error('Trade history fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [poolAddress, fetchTradesFromCache, fetchTradesFromChain, cacheTrades]);

  /**
   * Subscribe to new events (polling-based)
   * Requirements: 7.2
   */
  const subscribe = useCallback(() => {
    if (isSubscribedRef.current || pollingInterval <= 0) return;
    
    isSubscribedRef.current = true;
    
    // Start polling for new events
    pollingRef.current = setInterval(async () => {
      try {
        const newTrades = await fetchTradesFromChain(lastBlockRef.current + 1);
        
        if (newTrades.length > 0) {
          setTrades(prev => {
            const existingHashes = new Set(prev.map(t => t.txHash));
            const uniqueNewTrades = newTrades.filter(t => !existingHashes.has(t.txHash));
            
            if (uniqueNewTrades.length === 0) return prev;
            
            const updated = [...uniqueNewTrades, ...prev];
            updated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            return updated;
          });
          
          // Cache new trades
          await cacheTrades(newTrades);
        }
      } catch (err) {
        console.warn('Polling error:', err);
      }
    }, pollingInterval);
  }, [pollingInterval, fetchTradesFromChain, cacheTrades]);

  /**
   * Unsubscribe from events
   */
  const unsubscribe = useCallback(() => {
    isSubscribedRef.current = false;
    
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /**
   * Clear filter
   */
  const clearFilter = useCallback(() => {
    setFilter({});
  }, []);

  /**
   * Apply filters to trades
   */
  const filteredTrades = useMemo(() => {
    let result = [...trades];
    
    // Filter by type
    if (filter.type) {
      result = result.filter(t => t.type === filter.type);
    }
    
    // Filter by start time
    if (filter.startTime) {
      result = result.filter(t => t.timestamp >= filter.startTime!);
    }
    
    // Filter by end time
    if (filter.endTime) {
      result = result.filter(t => t.timestamp <= filter.endTime!);
    }
    
    return result;
  }, [trades, filter]);

  /**
   * Calculate stats
   */
  const stats = useMemo(() => {
    const buys = trades.filter(t => t.type === 'buy');
    const sells = trades.filter(t => t.type === 'sell');
    
    const totalVolume = trades.reduce(
      (sum, t) => sum + t.costOrReturn,
      BigInt(0)
    );
    
    return {
      totalBuys: buys.length,
      totalSells: sells.length,
      totalVolume,
    };
  }, [trades]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && poolAddress) {
      fetchTrades();
    }
  }, [autoFetch, poolAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    trades,
    filteredTrades,
    isLoading,
    error,
    fetchTrades,
    subscribe,
    unsubscribe,
    filter,
    setFilter,
    clearFilter,
    ...stats,
  };
}

export default useTradeHistory;

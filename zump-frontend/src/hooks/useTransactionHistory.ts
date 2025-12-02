/**
 * useTransactionHistory Hook
 * Manages transaction history with view tag scanning
 * Requirements: 10.2
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import { PrivateTransaction } from '../@types/privacy';
import { useStealthAddress } from './useStealthAddress';

// Storage key for transaction history
const TX_HISTORY_STORAGE_KEY = 'zump_tx_history';

export interface UseTransactionHistoryReturn {
  transactions: PrivateTransaction[];
  filteredTransactions: PrivateTransaction[];
  isLoading: boolean;
  error: string | null;
  refreshTransactions: () => Promise<void>;
  addTransaction: (tx: Omit<PrivateTransaction, 'id'>) => void;
  filterByViewTag: (viewTag: string | null) => void;
  filterByType: (type: PrivateTransaction['type'] | null) => void;
  clearHistory: () => void;
  activeViewTagFilter: string | null;
  activeTypeFilter: PrivateTransaction['type'] | null;
}

/**
 * Custom hook for transaction history management with view tag scanning
 */
export function useTransactionHistory(): UseTransactionHistoryReturn {
  const { address: walletAddress, isConnected } = useAccount();
  const { stealthAddresses } = useStealthAddress();
  
  const [transactions, setTransactions] = useState<PrivateTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeViewTagFilter, setActiveViewTagFilter] = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<PrivateTransaction['type'] | null>(null);

  // Get all view tags from stealth addresses
  const userViewTags = useMemo(() => {
    return stealthAddresses.map(sa => sa.viewTag);
  }, [stealthAddresses]);

  // Load transactions from localStorage on mount
  useEffect(() => {
    if (walletAddress && isConnected) {
      loadTransactions();
    } else {
      setTransactions([]);
    }
  }, [walletAddress, isConnected]);

  // Load transactions from localStorage
  const loadTransactions = useCallback(() => {
    if (!walletAddress) return;
    
    try {
      const storageKey = `${TX_HISTORY_STORAGE_KEY}_${walletAddress}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as PrivateTransaction[];
        setTransactions(parsed);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }, [walletAddress]);

  // Save transactions to localStorage
  const saveTransactions = useCallback((txs: PrivateTransaction[]) => {
    if (!walletAddress) return;
    
    try {
      const storageKey = `${TX_HISTORY_STORAGE_KEY}_${walletAddress}`;
      localStorage.setItem(storageKey, JSON.stringify(txs));
    } catch (err) {
      console.error('Failed to save transactions:', err);
    }
  }, [walletAddress]);

  // Filter transactions by user's view tags (only show user's own transactions)
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    // First, filter by user's view tags (only show transactions belonging to user)
    if (userViewTags.length > 0) {
      filtered = filtered.filter(tx => userViewTags.includes(tx.viewTag));
    }

    // Apply additional view tag filter if set
    if (activeViewTagFilter) {
      filtered = filtered.filter(tx => tx.viewTag === activeViewTagFilter);
    }

    // Apply type filter if set
    if (activeTypeFilter) {
      filtered = filtered.filter(tx => tx.type === activeTypeFilter);
    }

    // Sort by timestamp (newest first)
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, userViewTags, activeViewTagFilter, activeTypeFilter]);

  // Refresh transactions (fetch from blockchain/indexer)
  const refreshTransactions = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // In production, this would fetch from an indexer or blockchain
      // For now, we just reload from localStorage
      loadTransactions();
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to refresh transactions';
      setError(errorMessage);
      console.error('Transaction refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, walletAddress, loadTransactions]);

  // Add a new transaction
  const addTransaction = useCallback((tx: Omit<PrivateTransaction, 'id'>) => {
    const newTx: PrivateTransaction = {
      ...tx,
      id: generateTransactionId(),
    };

    const updatedTxs = [newTx, ...transactions];
    setTransactions(updatedTxs);
    saveTransactions(updatedTxs);
  }, [transactions, saveTransactions]);

  // Filter by specific view tag
  const filterByViewTag = useCallback((viewTag: string | null) => {
    setActiveViewTagFilter(viewTag);
  }, []);

  // Filter by transaction type
  const filterByType = useCallback((type: PrivateTransaction['type'] | null) => {
    setActiveTypeFilter(type);
  }, []);

  // Clear all transaction history
  const clearHistory = useCallback(() => {
    setTransactions([]);
    if (walletAddress) {
      const storageKey = `${TX_HISTORY_STORAGE_KEY}_${walletAddress}`;
      localStorage.removeItem(storageKey);
    }
  }, [walletAddress]);

  return {
    transactions,
    filteredTransactions,
    isLoading,
    error,
    refreshTransactions,
    addTransaction,
    filterByViewTag,
    filterByType,
    clearHistory,
    activeViewTagFilter,
    activeTypeFilter,
  };
}

// Helper: Generate unique transaction ID
function generateTransactionId(): string {
  return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default useTransactionHistory;

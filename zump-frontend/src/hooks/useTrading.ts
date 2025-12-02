/**
 * useTrading Hook
 * Handles buy/sell operations through the bonding curve
 * Requirements: 5.1, 5.2, 6.1, 6.2
 */

import { useState, useCallback, useMemo } from 'react';
import { useAccount } from '@starknet-react/core';
import { Account } from 'starknet';
import { getContractService, TransactionResult } from '../services/contractService';
import { getContractAddresses } from '../config/contracts';
import { 
  parseContractError, 
  ERROR_MESSAGES, 
  createTradingError,
  TradingError,
  RecoveryOption,
} from '../utils/tradingErrors';

// ===========================================
// Types (Re-export from tradingErrors)
// ===========================================

export type { TradingError, RecoveryOption };

export interface UseTradingOptions {
  poolAddress: string;
  tokenAddress: string;
  onSuccess?: (result: TransactionResult) => void;
  onError?: (error: TradingError) => void;
}

export interface UseTradingReturn {
  // Cost/Return calculations
  getBuyCost: (amount: bigint) => Promise<bigint>;
  getSellReturn: (amount: bigint) => Promise<bigint>;
  
  // Trading operations
  buy: (amount: bigint, maxCost?: bigint) => Promise<TransactionResult>;
  sell: (amount: bigint, minReturn?: bigint) => Promise<TransactionResult>;
  
  // State
  isBuying: boolean;
  isSelling: boolean;
  isCalculating: boolean;
  error: TradingError | null;
  
  // Helpers
  clearError: () => void;
  userTokenBalance: bigint | null;
  userQuoteBalance: bigint | null;
  refreshBalances: () => Promise<void>;
}

// ===========================================
// Hook Implementation
// ===========================================

/**
 * Hook for trading operations on bonding curve pools
 * 
 * Requirements:
 * - 5.1: Calculate buy cost using BondingCurvePool.get_buy_cost
 * - 5.2: Execute buy with approval flow
 * - 6.1: Calculate sell return using BondingCurvePool.get_sell_return
 * - 6.2: Execute sell with approval flow
 */
export function useTrading(options: UseTradingOptions): UseTradingReturn {
  const { poolAddress, tokenAddress, onSuccess, onError } = options;
  
  const { account, address } = useAccount();
  
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<TradingError | null>(null);
  const [userTokenBalance, setUserTokenBalance] = useState<bigint | null>(null);
  const [userQuoteBalance, setUserQuoteBalance] = useState<bigint | null>(null);

  const contractService = useMemo(() => getContractService(), []);
  const addresses = useMemo(() => getContractAddresses(), []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh user balances
   */
  const refreshBalances = useCallback(async () => {
    if (!address) {
      setUserTokenBalance(null);
      setUserQuoteBalance(null);
      return;
    }

    try {
      const [tokenBal, quoteBal] = await Promise.all([
        contractService.getBalance(tokenAddress, address),
        contractService.getBalance(addresses.quoteToken, address),
      ]);
      
      setUserTokenBalance(tokenBal);
      setUserQuoteBalance(quoteBal);
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    }
  }, [address, tokenAddress, addresses.quoteToken, contractService]);

  /**
   * Get buy cost for a given amount of tokens
   * Requirements: 5.1
   */
  const getBuyCost = useCallback(async (amount: bigint): Promise<bigint> => {
    if (amount <= BigInt(0)) {
      return BigInt(0);
    }

    setIsCalculating(true);
    try {
      const cost = await contractService.getBuyCost(poolAddress, amount);
      return cost;
    } catch (err) {
      console.error('Failed to calculate buy cost:', err);
      throw err;
    } finally {
      setIsCalculating(false);
    }
  }, [poolAddress, contractService]);

  /**
   * Get sell return for a given amount of tokens
   * Requirements: 6.1
   */
  const getSellReturn = useCallback(async (amount: bigint): Promise<bigint> => {
    if (amount <= BigInt(0)) {
      return BigInt(0);
    }

    setIsCalculating(true);
    try {
      const returnAmount = await contractService.getSellReturn(poolAddress, amount);
      return returnAmount;
    } catch (err) {
      console.error('Failed to calculate sell return:', err);
      throw err;
    } finally {
      setIsCalculating(false);
    }
  }, [poolAddress, contractService]);

  /**
   * Buy tokens from bonding curve
   * Requirements: 5.2
   */
  const buy = useCallback(async (
    amount: bigint,
    maxCost?: bigint
  ): Promise<TransactionResult> => {
    if (!account || !address) {
      const tradingError: TradingError = {
        code: 'ACCOUNT_NOT_CONNECTED',
        message: ERROR_MESSAGES['ACCOUNT_NOT_CONNECTED'],
      };
      setError(tradingError);
      onError?.(tradingError);
      throw new Error(tradingError.message);
    }

    setIsBuying(true);
    setError(null);

    try {
      // Set account on contract service
      contractService.setAccount(account as unknown as Account);

      // Calculate cost if maxCost not provided (for slippage check)
      const cost = maxCost || await getBuyCost(amount);
      
      // Check user has enough quote token balance
      const quoteBalance = await contractService.getBalance(addresses.quoteToken, address);
      if (quoteBalance < cost) {
        const tradingError: TradingError = {
          code: 'INSUFFICIENT_BALANCE',
          message: `${ERROR_MESSAGES['INSUFFICIENT_BALANCE']} Gerekli: ${cost.toString()}, Mevcut: ${quoteBalance.toString()}`,
        };
        setError(tradingError);
        onError?.(tradingError);
        throw new Error(tradingError.message);
      }

      // Approve quote token spending
      const currentAllowance = await contractService.getAllowance(
        addresses.quoteToken,
        address,
        poolAddress
      );

      if (currentAllowance < cost) {
        const approvalResult = await contractService.approve(
          addresses.quoteToken,
          poolAddress,
          cost
        );

        if (approvalResult.status === 'failed') {
          const tradingError: TradingError = {
            code: 'APPROVAL_FAILED',
            message: ERROR_MESSAGES['APPROVAL_FAILED'],
          };
          setError(tradingError);
          onError?.(tradingError);
          throw new Error(tradingError.message);
        }
      }

      // Execute buy
      const result = await contractService.buy(poolAddress, amount);

      if (result.status === 'confirmed') {
        // Refresh balances after successful buy
        await refreshBalances();
        onSuccess?.(result);
      } else if (result.status === 'failed') {
        const tradingError = parseContractError(result.error || 'Transaction failed');
        setError(tradingError);
        onError?.(tradingError);
      }

      return result;
    } catch (err) {
      const tradingError = parseContractError(err);
      setError(tradingError);
      onError?.(tradingError);
      throw err;
    } finally {
      setIsBuying(false);
    }
  }, [account, address, poolAddress, addresses.quoteToken, contractService, getBuyCost, refreshBalances, onSuccess, onError]);

  /**
   * Sell tokens to bonding curve
   * Requirements: 6.2
   */
  const sell = useCallback(async (
    amount: bigint,
    minReturn?: bigint
  ): Promise<TransactionResult> => {
    if (!account || !address) {
      const tradingError: TradingError = {
        code: 'ACCOUNT_NOT_CONNECTED',
        message: ERROR_MESSAGES['ACCOUNT_NOT_CONNECTED'],
      };
      setError(tradingError);
      onError?.(tradingError);
      throw new Error(tradingError.message);
    }

    setIsSelling(true);
    setError(null);

    try {
      // Set account on contract service
      contractService.setAccount(account as unknown as Account);

      // Check user has enough token balance
      const tokenBalance = await contractService.getBalance(tokenAddress, address);
      if (tokenBalance < amount) {
        const tradingError: TradingError = {
          code: 'INSUFFICIENT_BALANCE',
          message: `${ERROR_MESSAGES['INSUFFICIENT_BALANCE']} Gerekli: ${amount.toString()}, Mevcut: ${tokenBalance.toString()}`,
        };
        setError(tradingError);
        onError?.(tradingError);
        throw new Error(tradingError.message);
      }

      // Calculate expected return for slippage check
      if (minReturn) {
        const expectedReturn = await getSellReturn(amount);
        if (expectedReturn < minReturn) {
          const tradingError: TradingError = {
            code: 'SLIPPAGE_EXCEEDED',
            message: ERROR_MESSAGES['SLIPPAGE_EXCEEDED'],
          };
          setError(tradingError);
          onError?.(tradingError);
          throw new Error(tradingError.message);
        }
      }

      // Approve token spending
      const currentAllowance = await contractService.getAllowance(
        tokenAddress,
        address,
        poolAddress
      );

      if (currentAllowance < amount) {
        const approvalResult = await contractService.approve(
          tokenAddress,
          poolAddress,
          amount
        );

        if (approvalResult.status === 'failed') {
          const tradingError: TradingError = {
            code: 'APPROVAL_FAILED',
            message: ERROR_MESSAGES['APPROVAL_FAILED'],
          };
          setError(tradingError);
          onError?.(tradingError);
          throw new Error(tradingError.message);
        }
      }

      // Execute sell
      const result = await contractService.sell(poolAddress, amount);

      if (result.status === 'confirmed') {
        // Refresh balances after successful sell
        await refreshBalances();
        onSuccess?.(result);
      } else if (result.status === 'failed') {
        const tradingError = parseContractError(result.error || 'Transaction failed');
        setError(tradingError);
        onError?.(tradingError);
      }

      return result;
    } catch (err) {
      const tradingError = parseContractError(err);
      setError(tradingError);
      onError?.(tradingError);
      throw err;
    } finally {
      setIsSelling(false);
    }
  }, [account, address, poolAddress, tokenAddress, contractService, getSellReturn, refreshBalances, onSuccess, onError]);

  return {
    getBuyCost,
    getSellReturn,
    buy,
    sell,
    isBuying,
    isSelling,
    isCalculating,
    error,
    clearError,
    userTokenBalance,
    userQuoteBalance,
    refreshBalances,
  };
}

export default useTrading;

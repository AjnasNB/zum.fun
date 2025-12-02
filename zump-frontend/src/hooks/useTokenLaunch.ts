/**
 * useTokenLaunch Hook
 * Handles token launch functionality through PumpFactory contract
 * Requirements: 2.1, 2.4
 */

import { useState, useCallback } from 'react';
import { useAccount } from '@starknet-react/core';
import { Account, RpcProvider, Contract, CallData, cairo, shortString, EstimateFeeResponse } from 'starknet';
import { getContractService, LaunchParams, LaunchResult } from '../services/contractService';
import { getSupabaseService } from '../services/supabaseService';
import { TokenMetadataInsert } from '../@types/supabase';
import { getContractConfig, getContractAddresses } from '../config/contracts';
import { PUMP_FACTORY_ABI } from '../abi';

// ============================================================================
// Types
// ============================================================================

export interface LaunchFormData {
  name: string;
  symbol: string;
  description: string;
  imageFile?: File;
  imageUrl?: string;
  basePrice: string; // String for form input, converted to bigint
  slope: string;
  maxSupply: string;
  migrationThreshold?: string;
  tags?: string[];
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

export interface GasEstimate {
  estimatedFee: bigint;
  estimatedFeeFormatted: string;
  suggestedMaxFee: bigint;
  suggestedMaxFeeFormatted: string;
}

export interface LaunchState {
  isLaunching: boolean;
  isEstimating: boolean;
  error: Error | null;
  transactionHash: string | null;
  tokenAddress: string | null;
  poolAddress: string | null;
  launchId: bigint | null;
  gasEstimate: GasEstimate | null;
}

export interface UseTokenLaunchReturn extends LaunchState {
  launch: (params: LaunchFormData) => Promise<LaunchResult>;
  estimateGas: (params: LaunchFormData) => Promise<GasEstimate>;
  reset: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MIGRATION_THRESHOLD = BigInt('1000000000000000000000'); // 1000 tokens
const WEI_DECIMALS = 18;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse string amount to bigint with 18 decimals
 */
export const parseAmount = (amount: string, decimals: number = WEI_DECIMALS): bigint => {
  if (!amount || amount === '') return BigInt(0);
  
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const combined = whole + paddedFraction;
  
  return BigInt(combined);
};

/**
 * Format bigint to human-readable string
 */
export const formatAmount = (amount: bigint, decimals: number = WEI_DECIMALS): string => {
  const str = amount.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const fraction = str.slice(-decimals).replace(/0+$/, '');
  
  return fraction ? `${whole}.${fraction}` : whole;
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTokenLaunch(): UseTokenLaunchReturn {
  const { account, address } = useAccount();
  
  const [state, setState] = useState<LaunchState>({
    isLaunching: false,
    isEstimating: false,
    error: null,
    transactionHash: null,
    tokenAddress: null,
    poolAddress: null,
    launchId: null,
    gasEstimate: null,
  });

  /**
   * Reset state to initial values
   */
  const reset = useCallback(() => {
    setState({
      isLaunching: false,
      isEstimating: false,
      error: null,
      transactionHash: null,
      tokenAddress: null,
      poolAddress: null,
      launchId: null,
      gasEstimate: null,
    });
  }, []);

  /**
   * Build launch calldata from form data
   */
  const buildCalldata = useCallback((params: LaunchFormData, creatorAddress: string) => {
    const basePrice = parseAmount(params.basePrice);
    const slope = parseAmount(params.slope);
    const maxSupply = parseAmount(params.maxSupply);
    const migrationThreshold = params.migrationThreshold 
      ? parseAmount(params.migrationThreshold)
      : DEFAULT_MIGRATION_THRESHOLD;

    // Encode name and symbol as felt252
    const nameAsFelt = shortString.encodeShortString(params.name.slice(0, 31));
    const symbolAsFelt = shortString.encodeShortString(params.symbol.slice(0, 31));

    return {
      calldata: CallData.compile({
        name: nameAsFelt,
        symbol: symbolAsFelt,
        base_price: cairo.uint256(basePrice),
        slope: cairo.uint256(slope),
        max_supply: cairo.uint256(maxSupply),
        stealth_creator: creatorAddress,
        migration_threshold: cairo.uint256(migrationThreshold),
      }),
      launchParams: {
        name: params.name,
        symbol: params.symbol,
        basePrice,
        slope,
        maxSupply,
        stealthCreator: creatorAddress,
        migrationThreshold,
      } as LaunchParams,
    };
  }, []);

  /**
   * Estimate gas for token launch
   * Requirements: 2.4
   */
  const estimateGas = useCallback(async (params: LaunchFormData): Promise<GasEstimate> => {
    if (!account || !address) {
      throw new Error('Wallet not connected');
    }

    setState(prev => ({ ...prev, isEstimating: true, error: null }));

    try {
      const config = getContractConfig();
      const addresses = getContractAddresses();
      
      const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
      const factoryContract = new Contract(
        PUMP_FACTORY_ABI,
        addresses.pumpFactory,
        provider
      );

      const { calldata } = buildCalldata(params, address);

      // Estimate fee using the account
      const starknetAccount = account as unknown as Account;
      const estimateFeeResponse = await starknetAccount.estimateInvokeFee({
        contractAddress: addresses.pumpFactory,
        entrypoint: 'create_launch',
        calldata,
      });

      const estimate: GasEstimate = {
        estimatedFee: BigInt(estimateFeeResponse.overall_fee.toString()),
        estimatedFeeFormatted: formatAmount(BigInt(estimateFeeResponse.overall_fee.toString())),
        suggestedMaxFee: BigInt(estimateFeeResponse.suggestedMaxFee.toString()),
        suggestedMaxFeeFormatted: formatAmount(BigInt(estimateFeeResponse.suggestedMaxFee.toString())),
      };

      setState(prev => ({ ...prev, isEstimating: false, gasEstimate: estimate }));
      return estimate;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to estimate gas');
      setState(prev => ({ ...prev, isEstimating: false, error: err }));
      throw err;
    }
  }, [account, address, buildCalldata]);

  /**
   * Launch a new token
   * Requirements: 2.1, 2.2, 2.3
   */
  const launch = useCallback(async (params: LaunchFormData): Promise<LaunchResult> => {
    if (!account || !address) {
      throw new Error('Wallet not connected');
    }

    setState(prev => ({ 
      ...prev, 
      isLaunching: true, 
      error: null,
      transactionHash: null,
      tokenAddress: null,
      poolAddress: null,
      launchId: null,
    }));

    try {
      // Get contract service and set account
      const contractService = getContractService();
      contractService.setAccount(account as unknown as Account);

      // Build launch parameters
      const { launchParams } = buildCalldata(params, address);

      // Upload image if provided
      let imageUrl = params.imageUrl || '';
      if (params.imageFile) {
        try {
          const supabaseService = getSupabaseService();
          imageUrl = await supabaseService.uploadTokenImage(params.imageFile);
        } catch (uploadError) {
          console.warn('Failed to upload image, continuing without it:', uploadError);
        }
      }

      // Execute launch transaction
      const result = await contractService.createLaunch(launchParams);

      // Update state with transaction result
      setState(prev => ({
        ...prev,
        transactionHash: result.transactionHash,
        tokenAddress: result.tokenAddress,
        poolAddress: result.poolAddress,
        launchId: result.launchId,
      }));

      // Store metadata in Supabase after successful launch
      if (result.tokenAddress && result.tokenAddress !== '0x0') {
        try {
          const supabaseService = getSupabaseService();
          const metadata: TokenMetadataInsert = {
            token_address: result.tokenAddress,
            pool_address: result.poolAddress,
            launch_id: Number(result.launchId),
            name: params.name,
            symbol: params.symbol,
            description: params.description || null,
            image_url: imageUrl || null,
            creator_address: address,
            tags: params.tags || [],
            website_url: params.websiteUrl || null,
            twitter_url: params.twitterUrl || null,
            telegram_url: params.telegramUrl || null,
          };
          await supabaseService.createTokenMetadata(metadata);
        } catch (metadataError) {
          console.warn('Failed to store metadata, token was created successfully:', metadataError);
        }
      }

      setState(prev => ({ ...prev, isLaunching: false }));
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to launch token');
      setState(prev => ({ ...prev, isLaunching: false, error: err }));
      throw err;
    }
  }, [account, address, buildCalldata]);

  return {
    ...state,
    launch,
    estimateGas,
    reset,
  };
}

export default useTokenLaunch;

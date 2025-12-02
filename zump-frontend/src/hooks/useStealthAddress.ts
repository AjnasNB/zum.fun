/**
 * useStealthAddress Hook
 * Manages stealth address generation and storage
 * Requirements: 2.1, 2.2, 2.3, 10.3
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useContract, useSendTransaction } from '@starknet-react/core';
import { StealthAddress } from '../@types/privacy';

// Storage key for stealth addresses
const STEALTH_STORAGE_KEY = 'zump_stealth_addresses';

// Stealth Address Generator contract ABI (simplified for frontend)
const STEALTH_ABI = [
  {
    name: 'generate_fresh_stealth',
    type: 'function',
    inputs: [],
    outputs: [{ name: 'address', type: 'felt252' }],
    state_mutability: 'external',
  },
  {
    name: 'generate_stealth_address',
    type: 'function',
    inputs: [
      { name: 'spending_pubkey', type: 'felt252' },
      { name: 'viewing_pubkey', type: 'felt252' },
      { name: 'ephemeral_random', type: 'felt252' },
    ],
    outputs: [
      { name: 'address', type: 'felt252' },
      { name: 'view_tag', type: 'felt252' },
      { name: 'ephemeral_pubkey', type: 'felt252' },
    ],
    state_mutability: 'external',
  },
  {
    name: 'is_valid_stealth',
    type: 'function',
    inputs: [{ name: 'address', type: 'felt252' }],
    outputs: [{ name: 'is_valid', type: 'felt252' }],
    state_mutability: 'view',
  },
] as const;

// Contract address (to be configured per environment)
const STEALTH_CONTRACT_ADDRESS = process.env.REACT_APP_STEALTH_CONTRACT_ADDRESS || '0x0';

export interface UseStealthAddressReturn {
  stealthAddresses: StealthAddress[];
  isGenerating: boolean;
  error: string | null;
  generateStealthAddress: () => Promise<StealthAddress | null>;
  removeStealthAddress: (address: string) => void;
  clearAllStealthAddresses: () => void;
  getStealthAddressByViewTag: (viewTag: string) => StealthAddress | undefined;
}

/**
 * Custom hook for stealth address management
 */
export function useStealthAddress(): UseStealthAddressReturn {
  const { address: walletAddress, isConnected } = useAccount();
  const [stealthAddresses, setStealthAddresses] = useState<StealthAddress[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { contract } = useContract({
    abi: STEALTH_ABI,
    address: STEALTH_CONTRACT_ADDRESS as `0x${string}`,
  });

  const { sendAsync } = useSendTransaction({});

  // Load stealth addresses from localStorage on mount
  useEffect(() => {
    if (walletAddress && isConnected) {
      loadStealthAddresses();
    } else {
      setStealthAddresses([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, isConnected]);

  // Load stealth addresses from localStorage
  const loadStealthAddresses = useCallback(() => {
    if (!walletAddress) return;
    
    try {
      const storageKey = `${STEALTH_STORAGE_KEY}_${walletAddress}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as StealthAddress[];
        setStealthAddresses(parsed);
      }
    } catch (err) {
      console.error('Failed to load stealth addresses:', err);
    }
  }, [walletAddress]);

  // Save stealth addresses to localStorage
  const saveStealthAddresses = useCallback((addresses: StealthAddress[]) => {
    if (!walletAddress) return;
    
    try {
      const storageKey = `${STEALTH_STORAGE_KEY}_${walletAddress}`;
      localStorage.setItem(storageKey, JSON.stringify(addresses));
    } catch (err) {
      console.error('Failed to save stealth addresses:', err);
    }
  }, [walletAddress]);

  // Generate a new stealth address
  const generateStealthAddress = useCallback(async (): Promise<StealthAddress | null> => {
    if (!isConnected || !walletAddress) {
      setError('Wallet not connected');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate random values for stealth address derivation
      const spendingPubkey = generateRandomFelt();
      const viewingPubkey = generateRandomFelt();
      const ephemeralRandom = generateRandomFelt();

      // For now, create a local stealth address (in production, call contract)
      const newStealthAddress: StealthAddress = {
        address: generateLocalStealthAddress(walletAddress.toString(), stealthAddresses.length),
        viewTag: generateViewTag(viewingPubkey, ephemeralRandom),
        ephemeralPubkey: ephemeralRandom,
        createdAt: Date.now(),
      };

      const updatedAddresses = [...stealthAddresses, newStealthAddress];
      setStealthAddresses(updatedAddresses);
      saveStealthAddresses(updatedAddresses);

      return newStealthAddress;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to generate stealth address';
      setError(errorMessage);
      console.error('Stealth address generation error:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [isConnected, walletAddress, stealthAddresses, saveStealthAddresses]);

  // Remove a stealth address
  const removeStealthAddress = useCallback((address: string) => {
    const updatedAddresses = stealthAddresses.filter(sa => sa.address !== address);
    setStealthAddresses(updatedAddresses);
    saveStealthAddresses(updatedAddresses);
  }, [stealthAddresses, saveStealthAddresses]);

  // Clear all stealth addresses
  const clearAllStealthAddresses = useCallback(() => {
    setStealthAddresses([]);
    if (walletAddress) {
      const storageKey = `${STEALTH_STORAGE_KEY}_${walletAddress}`;
      localStorage.removeItem(storageKey);
    }
  }, [walletAddress]);

  // Get stealth address by view tag
  const getStealthAddressByViewTag = useCallback((viewTag: string): StealthAddress | undefined => {
    return stealthAddresses.find(sa => sa.viewTag === viewTag);
  }, [stealthAddresses]);

  return {
    stealthAddresses,
    isGenerating,
    error,
    generateStealthAddress,
    removeStealthAddress,
    clearAllStealthAddresses,
    getStealthAddressByViewTag,
  };
}

// Helper: Generate random felt252 value
function generateRandomFelt(): string {
  const bytes = new Uint8Array(31); // 31 bytes to stay within felt252 range
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Generate local stealth address (for demo/testing)
function generateLocalStealthAddress(walletAddress: string, index: number): string {
  const timestamp = Date.now();
  const combined = `${walletAddress}_${index}_${timestamp}`;
  // Simple hash simulation - in production, use proper Poseidon hash
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64);
}

// Helper: Generate view tag
function generateViewTag(viewingPubkey: string, ephemeralPubkey: string): string {
  const combined = `${viewingPubkey}_${ephemeralPubkey}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(16, '0').slice(0, 16);
}

export default useStealthAddress;

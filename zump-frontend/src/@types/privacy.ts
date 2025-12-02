/**
 * Privacy Types
 * Type definitions for privacy-related features
 * Requirements: 2.1, 2.2, 2.3, 10.2, 10.3, 10.4
 */

// Stealth Address structure matching the Cairo contract
export interface StealthAddress {
  address: string;
  viewTag: string;
  ephemeralPubkey: string;
  createdAt: number;
}

// Transaction with privacy metadata
export interface PrivateTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'transfer';
  amount: string;
  token: string;
  tokenSymbol: string;
  commitment: string;
  viewTag: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
}

// Balance for a stealth address
export interface StealthBalance {
  address: string;
  token: string;
  tokenSymbol: string;
  balance: string;
  formattedBalance: string;
}

// Aggregated balance across all stealth addresses
export interface AggregatedBalance {
  token: string;
  tokenSymbol: string;
  totalBalance: string;
  formattedBalance: string;
  stealthBalances: StealthBalance[];
}

// Error types for privacy operations
export interface PrivacyError {
  code: string;
  message: string;
  recoveryOptions: RecoveryOption[];
}

export interface RecoveryOption {
  action: string;
  description: string;
  handler?: () => Promise<void>;
}

// Contract error codes mapping
export const CONTRACT_ERROR_CODES: Record<string, string> = {
  'NOT_AUTHORIZED': 'Bu işlem için yetkiniz yok',
  'NULLIFIER_ALREADY_SPENT': 'Bu işlem zaten gerçekleştirilmiş',
  'INVALID_PROOF': 'ZK kanıtı doğrulanamadı',
  'PROOF_EXPIRED': 'Kanıt süresi dolmuş, yeniden oluşturun',
  'ALREADY_MIGRATED': 'Bu havuz DEX\'e taşınmış',
  'MAX_SUPPLY_REACHED': 'Maksimum arz limitine ulaşıldı',
  'INSUFFICIENT_BALANCE': 'Yetersiz bakiye',
  'INSUFFICIENT_RESERVE': 'Havuzda yetersiz rezerv',
  'INVALID_COMMITMENT': 'Geçersiz commitment',
  'TOKEN_NOT_SUPPORTED': 'Bu token desteklenmiyor',
  'AMOUNT_TOO_LOW': 'Miktar çok düşük',
  'AMOUNT_TOO_HIGH': 'Miktar çok yüksek',
  'TREE_FULL': 'Merkle ağacı dolu',
  'INVALID_MERKLE_PROOF': 'Geçersiz Merkle kanıtı',
};

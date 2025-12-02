/**
 * usePrivacyError Hook
 * Manages error handling and recovery for privacy operations
 * Requirements: 10.5
 */

import { useState, useCallback, useMemo } from 'react';
import { PrivacyError, RecoveryOption, CONTRACT_ERROR_CODES } from '../@types/privacy';

export interface UsePrivacyErrorReturn {
  error: PrivacyError | null;
  setError: (error: PrivacyError | null) => void;
  parseContractError: (errorMessage: string) => PrivacyError;
  clearError: () => void;
  handleError: (error: unknown, context?: string) => PrivacyError;
  getRecoveryOptions: (errorCode: string) => RecoveryOption[];
}

// Recovery options for different error types
const RECOVERY_OPTIONS: Record<string, RecoveryOption[]> = {
  NOT_AUTHORIZED: [
    {
      action: 'check_wallet',
      description: 'Cüzdan bağlantınızı kontrol edin',
    },
    {
      action: 'reconnect',
      description: 'Cüzdanı yeniden bağlayın',
    },
  ],
  NULLIFIER_ALREADY_SPENT: [
    {
      action: 'check_history',
      description: 'İşlem geçmişinizi kontrol edin',
    },
    {
      action: 'contact_support',
      description: 'Destek ile iletişime geçin',
    },
  ],
  INVALID_PROOF: [
    {
      action: 'regenerate_proof',
      description: 'ZK kanıtını yeniden oluşturun',
    },
    {
      action: 'retry',
      description: 'İşlemi tekrar deneyin',
    },
  ],
  PROOF_EXPIRED: [
    {
      action: 'regenerate_proof',
      description: 'Yeni bir ZK kanıtı oluşturun',
    },
  ],
  ALREADY_MIGRATED: [
    {
      action: 'use_dex',
      description: 'DEX üzerinden işlem yapın',
    },
    {
      action: 'find_pool',
      description: 'Başka bir havuz bulun',
    },
  ],
  MAX_SUPPLY_REACHED: [
    {
      action: 'reduce_amount',
      description: 'Daha düşük miktar deneyin',
    },
    {
      action: 'wait',
      description: 'Satış bekleyin',
    },
  ],
  INSUFFICIENT_BALANCE: [
    {
      action: 'add_funds',
      description: 'Bakiye ekleyin',
    },
    {
      action: 'reduce_amount',
      description: 'Daha düşük miktar deneyin',
    },
  ],
  INSUFFICIENT_RESERVE: [
    {
      action: 'reduce_amount',
      description: 'Daha düşük miktar deneyin',
    },
    {
      action: 'wait',
      description: 'Havuz likiditesinin artmasını bekleyin',
    },
  ],
  INVALID_COMMITMENT: [
    {
      action: 'regenerate',
      description: 'Commitment\'ı yeniden oluşturun',
    },
    {
      action: 'retry',
      description: 'İşlemi tekrar deneyin',
    },
  ],
  TOKEN_NOT_SUPPORTED: [
    {
      action: 'check_tokens',
      description: 'Desteklenen tokenleri kontrol edin',
    },
    {
      action: 'swap',
      description: 'Desteklenen bir tokena swap yapın',
    },
  ],
  AMOUNT_TOO_LOW: [
    {
      action: 'increase_amount',
      description: 'Miktarı artırın',
    },
    {
      action: 'check_limits',
      description: 'Minimum limitleri kontrol edin',
    },
  ],
  AMOUNT_TOO_HIGH: [
    {
      action: 'reduce_amount',
      description: 'Miktarı azaltın',
    },
    {
      action: 'split_transaction',
      description: 'İşlemi bölerek yapın',
    },
  ],
  TREE_FULL: [
    {
      action: 'wait',
      description: 'Yeni ağaç oluşturulmasını bekleyin',
    },
    {
      action: 'contact_support',
      description: 'Destek ile iletişime geçin',
    },
  ],
  INVALID_MERKLE_PROOF: [
    {
      action: 'regenerate_proof',
      description: 'Merkle kanıtını yeniden oluşturun',
    },
    {
      action: 'retry',
      description: 'İşlemi tekrar deneyin',
    },
  ],
  NETWORK_ERROR: [
    {
      action: 'check_connection',
      description: 'İnternet bağlantınızı kontrol edin',
    },
    {
      action: 'retry',
      description: 'Tekrar deneyin',
    },
  ],
  WALLET_REJECTED: [
    {
      action: 'retry',
      description: 'İşlemi tekrar onaylayın',
    },
  ],
  UNKNOWN: [
    {
      action: 'retry',
      description: 'Tekrar deneyin',
    },
    {
      action: 'contact_support',
      description: 'Destek ile iletişime geçin',
    },
  ],
};

/**
 * Custom hook for privacy error handling
 */
export function usePrivacyError(): UsePrivacyErrorReturn {
  const [error, setError] = useState<PrivacyError | null>(null);

  // Parse contract error message to user-friendly format
  const parseContractError = useCallback((errorMessage: string): PrivacyError => {
    // Try to extract error code from message
    const errorCode = extractErrorCode(errorMessage);
    const userMessage = CONTRACT_ERROR_CODES[errorCode] || errorMessage;
    const recoveryOptions = RECOVERY_OPTIONS[errorCode] || RECOVERY_OPTIONS.UNKNOWN;

    return {
      code: errorCode,
      message: userMessage,
      recoveryOptions,
    };
  }, []);

  // Clear current error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Handle any error and convert to PrivacyError
  const handleError = useCallback((err: unknown, context?: string): PrivacyError => {
    let errorMessage = 'Bilinmeyen bir hata oluştu';
    let errorCode = 'UNKNOWN';

    if (err instanceof Error) {
      errorMessage = err.message;
      
      // Check for wallet rejection
      if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorCode = 'WALLET_REJECTED';
        errorMessage = 'İşlem cüzdan tarafından reddedildi';
      }
      // Check for network errors
      else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorCode = 'NETWORK_ERROR';
        errorMessage = 'Ağ bağlantı hatası';
      }
      // Try to extract contract error
      else {
        errorCode = extractErrorCode(errorMessage);
        if (CONTRACT_ERROR_CODES[errorCode]) {
          errorMessage = CONTRACT_ERROR_CODES[errorCode];
        }
      }
    } else if (typeof err === 'string') {
      errorMessage = err;
      errorCode = extractErrorCode(err);
      if (CONTRACT_ERROR_CODES[errorCode]) {
        errorMessage = CONTRACT_ERROR_CODES[errorCode];
      }
    }

    // Add context if provided
    if (context) {
      errorMessage = `${context}: ${errorMessage}`;
    }

    const privacyError: PrivacyError = {
      code: errorCode,
      message: errorMessage,
      recoveryOptions: RECOVERY_OPTIONS[errorCode] || RECOVERY_OPTIONS.UNKNOWN,
    };

    setError(privacyError);
    return privacyError;
  }, []);

  // Get recovery options for a specific error code
  const getRecoveryOptions = useCallback((errorCode: string): RecoveryOption[] => {
    return RECOVERY_OPTIONS[errorCode] || RECOVERY_OPTIONS.UNKNOWN;
  }, []);

  return {
    error,
    setError,
    parseContractError,
    clearError,
    handleError,
    getRecoveryOptions,
  };
}

// Helper: Extract error code from error message
function extractErrorCode(message: string): string {
  // Check for known error codes in the message
  const knownCodes = Object.keys(CONTRACT_ERROR_CODES);
  
  for (const code of knownCodes) {
    if (message.includes(code)) {
      return code;
    }
  }

  // Check for common patterns
  if (message.includes('not authorized') || message.includes('unauthorized')) {
    return 'NOT_AUTHORIZED';
  }
  if (message.includes('already spent') || message.includes('double spend')) {
    return 'NULLIFIER_ALREADY_SPENT';
  }
  if (message.includes('invalid proof')) {
    return 'INVALID_PROOF';
  }
  if (message.includes('expired')) {
    return 'PROOF_EXPIRED';
  }
  if (message.includes('migrated')) {
    return 'ALREADY_MIGRATED';
  }
  if (message.includes('insufficient balance')) {
    return 'INSUFFICIENT_BALANCE';
  }
  if (message.includes('insufficient reserve')) {
    return 'INSUFFICIENT_RESERVE';
  }

  return 'UNKNOWN';
}

export default usePrivacyError;

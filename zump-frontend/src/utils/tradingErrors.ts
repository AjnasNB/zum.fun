/**
 * Trading Error Handling Utilities
 * Centralized error handling for trading operations
 * Requirements: 5.5, 6.5
 */

// ===========================================
// Types
// ===========================================

export interface TradingError {
  code: string;
  message: string;
  recoveryOptions?: RecoveryOption[];
}

export interface RecoveryOption {
  label: string;
  action: () => void;
}

// ===========================================
// Error Messages (Turkish)
// ===========================================

export const ERROR_MESSAGES: Record<string, string> = {
  // Balance errors - Requirements: 5.5
  'INSUFFICIENT_BALANCE': 'Yetersiz bakiye. Lütfen bakiyenizi kontrol edin.',
  'INSUFFICIENT_QUOTE_BALANCE': 'Yetersiz ETH bakiyesi. Lütfen cüzdanınıza ETH ekleyin.',
  'INSUFFICIENT_TOKEN_BALANCE': 'Yetersiz token bakiyesi. Satmak için yeterli tokenınız yok.',
  
  // Pool errors - Requirements: 6.5
  'INSUFFICIENT_RESERVE': 'Havuzda yeterli likidite yok.',
  'ALREADY_MIGRATED': 'Bu havuz DEX\'e taşınmış. Lütfen DEX üzerinden işlem yapın.',
  'MAX_SUPPLY_REACHED': 'Maksimum arz limitine ulaşıldı.',
  'INSUFFICIENT_TOKENS_SOLD': 'Satılabilecek yeterli token yok.',
  
  // Authorization errors
  'NOT_AUTHORIZED': 'Bu işlem için yetkiniz yok.',
  'ACCOUNT_NOT_CONNECTED': 'Lütfen cüzdanınızı bağlayın.',
  
  // Transaction errors
  'INVALID_AMOUNT': 'Geçersiz miktar. Lütfen pozitif bir değer girin.',
  'SLIPPAGE_EXCEEDED': 'Fiyat kayması toleransı aşıldı. Lütfen tekrar deneyin veya slippage değerini artırın.',
  'APPROVAL_FAILED': 'Token onayı başarısız oldu. Lütfen tekrar deneyin.',
  'TRANSACTION_FAILED': 'İşlem başarısız oldu. Lütfen tekrar deneyin.',
  'TRANSACTION_REJECTED': 'İşlem reddedildi. Cüzdanınızda işlemi onaylayın.',
  
  // Network errors
  'NETWORK_ERROR': 'Ağ hatası. Lütfen internet bağlantınızı kontrol edin.',
  'NETWORK_TIMEOUT': 'Ağ zaman aşımı. Lütfen tekrar deneyin.',
  'RPC_ERROR': 'RPC hatası. Lütfen daha sonra tekrar deneyin.',
  
  // Unknown error
  'UNKNOWN_ERROR': 'Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.',
};

// ===========================================
// Error Parsing
// ===========================================

/**
 * Parse error message from contract error
 * Requirements: 5.5, 6.5
 */
export const parseContractError = (error: unknown): TradingError => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorLower = errorMessage.toLowerCase();
  
  // Check for known error codes
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.includes(code) || errorLower.includes(code.toLowerCase())) {
      return createTradingError(code, message);
    }
  }
  
  // Check for specific error patterns
  if (errorLower.includes('insufficient') && errorLower.includes('balance')) {
    return createTradingError('INSUFFICIENT_BALANCE', ERROR_MESSAGES['INSUFFICIENT_BALANCE']);
  }
  
  if (errorLower.includes('migrated')) {
    return createTradingError('ALREADY_MIGRATED', ERROR_MESSAGES['ALREADY_MIGRATED'], [
      {
        label: 'DEX\'e Git',
        action: () => window.open('https://app.avnu.fi', '_blank'),
      },
    ]);
  }
  
  if (errorLower.includes('rejected') || errorLower.includes('denied')) {
    return createTradingError('TRANSACTION_REJECTED', ERROR_MESSAGES['TRANSACTION_REJECTED']);
  }
  
  if (errorLower.includes('timeout')) {
    return createTradingError('NETWORK_TIMEOUT', ERROR_MESSAGES['NETWORK_TIMEOUT']);
  }
  
  if (errorLower.includes('network') || errorLower.includes('connection')) {
    return createTradingError('NETWORK_ERROR', ERROR_MESSAGES['NETWORK_ERROR']);
  }
  
  if (errorLower.includes('slippage')) {
    return createTradingError('SLIPPAGE_EXCEEDED', ERROR_MESSAGES['SLIPPAGE_EXCEEDED']);
  }
  
  // Default error
  return createTradingError('UNKNOWN_ERROR', errorMessage || ERROR_MESSAGES['UNKNOWN_ERROR']);
};

/**
 * Create a TradingError object
 */
export const createTradingError = (
  code: string,
  message: string,
  recoveryOptions?: RecoveryOption[]
): TradingError => ({
  code,
  message,
  recoveryOptions,
});

// ===========================================
// Error Recovery Actions
// ===========================================

/**
 * Get recovery options for a specific error code
 * Requirements: 5.5, 6.5
 */
export const getRecoveryOptions = (errorCode: string): RecoveryOption[] => {
  switch (errorCode) {
    case 'ALREADY_MIGRATED':
      return [
        {
          label: 'DEX\'e Git',
          action: () => window.open('https://app.avnu.fi', '_blank'),
        },
      ];
    
    case 'INSUFFICIENT_QUOTE_BALANCE':
      return [
        {
          label: 'ETH Al',
          action: () => window.open('https://app.avnu.fi/swap', '_blank'),
        },
      ];
    
    case 'SLIPPAGE_EXCEEDED':
      return [
        {
          label: 'Slippage Artır',
          action: () => {}, // This should be handled by the component
        },
      ];
    
    case 'NETWORK_ERROR':
    case 'NETWORK_TIMEOUT':
    case 'RPC_ERROR':
      return [
        {
          label: 'Tekrar Dene',
          action: () => window.location.reload(),
        },
      ];
    
    default:
      return [];
  }
};

// ===========================================
// Error Display Helpers
// ===========================================

/**
 * Check if error is recoverable
 */
export const isRecoverableError = (errorCode: string): boolean => {
  const nonRecoverableErrors = [
    'NOT_AUTHORIZED',
    'MAX_SUPPLY_REACHED',
  ];
  return !nonRecoverableErrors.includes(errorCode);
};

/**
 * Check if error requires DEX redirect
 * Requirements: 6.5
 */
export const requiresDexRedirect = (errorCode: string): boolean => {
  return errorCode === 'ALREADY_MIGRATED';
};

/**
 * Get error severity for display
 */
export const getErrorSeverity = (errorCode: string): 'error' | 'warning' | 'info' => {
  if (errorCode === 'ALREADY_MIGRATED') {
    return 'warning';
  }
  if (errorCode === 'SLIPPAGE_EXCEEDED') {
    return 'warning';
  }
  return 'error';
};

export default {
  ERROR_MESSAGES,
  parseContractError,
  createTradingError,
  getRecoveryOptions,
  isRecoverableError,
  requiresDexRedirect,
  getErrorSeverity,
};

/**
 * Launch Utilities
 * Helper functions for token launch operations
 * Requirements: 2.2
 */

// ============================================================================
// Types
// ============================================================================

export interface LaunchCreatedEventData {
  launchId: bigint;
  token: string;
  pool: string;
  stealthCreator?: string;
  migrationThreshold?: bigint;
}

export interface TransactionReceipt {
  events?: TransactionEvent[];
  transaction_hash?: string;
  block_number?: number;
  status?: string;
}

export interface TransactionEvent {
  keys?: string[];
  data?: string[];
  from_address?: string;
}

// ============================================================================
// Constants
// ============================================================================

// LaunchCreated event selector (keccak256 of event signature)
// This should match the actual event selector from the contract
const LAUNCH_CREATED_EVENT_KEY = '0x'; // Will be populated based on actual contract

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse u256 from contract response
 * Handles both bigint and {low, high} object formats
 */
export const parseU256 = (value: any): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'low' in value && 'high' in value) {
    const low = BigInt(value.low.toString());
    const high = BigInt(value.high.toString());
    return low + (high << BigInt(128));
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return BigInt(value.toString());
  }
  return BigInt(0);
};

/**
 * Validate contract address format
 * Returns true if address is valid (non-zero, starts with 0x)
 */
export const isValidAddress = (address: string | undefined | null): boolean => {
  if (!address) return false;
  if (address === '0x0' || address === '0x') return false;
  if (!address.startsWith('0x')) return false;
  // Check if it's a valid hex string
  const hexPart = address.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) return false;
  // Check if it's not all zeros
  if (/^0+$/.test(hexPart)) return false;
  return true;
};

/**
 * Extract LaunchCreated event data from transaction receipt
 * Requirements: 2.2 - Extract token and pool addresses from receipt
 * 
 * Property 1: Launch Receipt Address Extraction
 * For any valid transaction receipt containing a LaunchCreated event,
 * extracting token and pool addresses should return valid non-zero addresses
 * that match the event data.
 */
export const extractLaunchCreatedEvent = (
  receipt: TransactionReceipt
): LaunchCreatedEventData | null => {
  try {
    const events = receipt.events || [];
    
    if (events.length === 0) {
      return null;
    }

    // Iterate through events to find LaunchCreated
    for (const event of events) {
      // Check if event has required structure
      if (!event.keys || !event.data) {
        continue;
      }

      // LaunchCreated event structure from PumpFactory:
      // Keys: [event_selector, launch_id]
      // Data: [token, pool, stealth_creator, migration_threshold_low, migration_threshold_high]
      
      // We need at least 1 key (launch_id) and 2 data items (token, pool)
      if (event.keys.length >= 1 && event.data.length >= 2) {
        const launchId = parseU256(event.keys[event.keys.length - 1]); // Last key is launch_id
        const token = event.data[0]?.toString() || '0x0';
        const pool = event.data[1]?.toString() || '0x0';
        
        // Validate extracted addresses
        if (isValidAddress(token) && isValidAddress(pool)) {
          const result: LaunchCreatedEventData = {
            launchId,
            token,
            pool,
          };

          // Extract optional fields if present
          if (event.data.length >= 3) {
            result.stealthCreator = event.data[2]?.toString();
          }
          if (event.data.length >= 5) {
            result.migrationThreshold = parseU256({
              low: event.data[3],
              high: event.data[4],
            });
          }

          return result;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to extract LaunchCreated event:', error);
    return null;
  }
};

/**
 * Format address for display (0x1234...5678)
 */
export const formatAddress = (address: string, startChars: number = 6, endChars: number = 4): string => {
  if (!address || address.length < startChars + endChars + 3) {
    return address || '';
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Build explorer URL for transaction
 */
export const getExplorerTxUrl = (txHash: string, network: 'mainnet' | 'sepolia' = 'sepolia'): string => {
  const baseUrl = network === 'mainnet' 
    ? 'https://starkscan.co' 
    : 'https://sepolia.starkscan.co';
  return `${baseUrl}/tx/${txHash}`;
};

/**
 * Build explorer URL for contract/address
 */
export const getExplorerAddressUrl = (address: string, network: 'mainnet' | 'sepolia' = 'sepolia'): string => {
  const baseUrl = network === 'mainnet' 
    ? 'https://starkscan.co' 
    : 'https://sepolia.starkscan.co';
  return `${baseUrl}/contract/${address}`;
};

export default {
  parseU256,
  isValidAddress,
  extractLaunchCreatedEvent,
  formatAddress,
  getExplorerTxUrl,
  getExplorerAddressUrl,
};

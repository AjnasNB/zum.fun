/**
 * Bonding Curve Utilities
 * Helper functions for bonding curve price and progress calculations
 * Requirements: 4.2, 4.3
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Precision for percentage calculations (2 decimal places)
 */
export const PERCENTAGE_PRECISION = 100;

/**
 * Maximum progress percentage
 */
export const MAX_PROGRESS = 100;

/**
 * Minimum progress percentage
 */
export const MIN_PROGRESS = 0;

// ============================================================================
// Price Calculation
// ============================================================================

/**
 * Calculate current price from bonding curve formula
 * Formula: price = base_price + (slope × tokens_sold)
 * 
 * Property 4: Bonding Curve Price Calculation
 * For any pool state, the displayed price should exactly match the formula:
 * price = base_price + (slope × tokens_sold)
 * 
 * Requirements: 4.2
 * 
 * @param basePrice - The base price of the bonding curve (bigint)
 * @param slope - The slope of the bonding curve (bigint)
 * @param tokensSold - The number of tokens sold (bigint)
 * @returns The calculated current price (bigint)
 */
export const calculatePrice = (
  basePrice: bigint,
  slope: bigint,
  tokensSold: bigint
): bigint => {
  // Ensure all inputs are valid bigints
  const base = BigInt(basePrice);
  const s = BigInt(slope);
  const sold = BigInt(tokensSold);
  
  // price = base_price + (slope × tokens_sold)
  return base + s * sold;
};

// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Calculate bonding curve progress percentage
 * Formula: progress = (tokens_sold / max_supply) × 100
 * 
 * Property 5: Bonding Curve Progress Calculation
 * For any tokens_sold and max_supply values, the progress percentage should
 * equal (tokens_sold / max_supply) × 100, bounded between 0 and 100.
 * 
 * Requirements: 4.3
 * 
 * @param tokensSold - The number of tokens sold (bigint)
 * @param maxSupply - The maximum supply of tokens (bigint)
 * @returns The progress percentage (number between 0 and 100)
 */
export const calculateProgress = (
  tokensSold: bigint,
  maxSupply: bigint
): number => {
  // Handle edge case: max supply is zero
  if (maxSupply === BigInt(0)) {
    return MIN_PROGRESS;
  }
  
  const sold = BigInt(tokensSold);
  const max = BigInt(maxSupply);
  
  // Handle edge case: tokens sold is zero
  if (sold === BigInt(0)) {
    return MIN_PROGRESS;
  }
  
  // Handle edge case: tokens sold >= max supply
  if (sold >= max) {
    return MAX_PROGRESS;
  }
  
  // Calculate progress with precision
  // Multiply by 10000 first to get 2 decimal places, then divide by 100
  const progressScaled = (sold * BigInt(10000)) / max;
  const progress = Number(progressScaled) / PERCENTAGE_PRECISION;
  
  // Clamp between 0 and 100
  return Math.min(Math.max(progress, MIN_PROGRESS), MAX_PROGRESS);
};

// ============================================================================
// Market Cap Calculation
// ============================================================================

/**
 * Calculate market cap
 * Formula: marketCap = current_price × tokens_sold
 * 
 * @param currentPrice - The current price (bigint)
 * @param tokensSold - The number of tokens sold (bigint)
 * @returns The market cap (bigint)
 */
export const calculateMarketCap = (
  currentPrice: bigint,
  tokensSold: bigint
): bigint => {
  return BigInt(currentPrice) * BigInt(tokensSold);
};

// ============================================================================
// BigInt Handling Utilities
// ============================================================================

/**
 * Parse u256 from contract response
 * Handles both bigint and {low, high} object formats
 * 
 * @param value - The value to parse (can be bigint, object with low/high, string, or number)
 * @returns The parsed bigint value
 */
export const parseU256 = (value: unknown): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }
  
  if (typeof value === 'object' && value !== null && 'low' in value && 'high' in value) {
    const obj = value as { low: unknown; high: unknown };
    const low = BigInt(String(obj.low));
    const high = BigInt(String(obj.high));
    return low + (high << BigInt(128));
  }
  
  if (typeof value === 'string' || typeof value === 'number') {
    return BigInt(value.toString());
  }
  
  return BigInt(0);
};

/**
 * Format bigint to human-readable string with decimals
 * 
 * @param value - The bigint value to format
 * @param decimals - Number of decimals (default 18 for ETH/STRK)
 * @param displayDecimals - Number of decimals to display (default 4)
 * @returns Formatted string
 */
export const formatBigIntWithDecimals = (
  value: bigint,
  decimals: number = 18,
  displayDecimals: number = 4
): string => {
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  // Convert fractional part to string with leading zeros
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const displayFractional = fractionalStr.slice(0, displayDecimals);
  
  // Remove trailing zeros from fractional part
  const trimmedFractional = displayFractional.replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return integerPart.toString();
  }
  
  return `${integerPart}.${trimmedFractional}`;
};

/**
 * Convert number to bigint with decimals
 * 
 * @param value - The number value to convert
 * @param decimals - Number of decimals (default 18)
 * @returns The bigint value
 */
export const toBigIntWithDecimals = (
  value: number | string,
  decimals: number = 18
): bigint => {
  const strValue = value.toString();
  const [integerPart, fractionalPart = ''] = strValue.split('.');
  
  // Pad or truncate fractional part to match decimals
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  
  // Combine integer and fractional parts
  const combined = integerPart + paddedFractional;
  
  return BigInt(combined);
};

/**
 * Safe division for bigints (returns 0 if divisor is 0)
 * 
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @returns The result of division or 0 if denominator is 0
 */
export const safeDivide = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator === BigInt(0)) {
    return BigInt(0);
  }
  return numerator / denominator;
};

/**
 * Compare two bigints
 * 
 * @param a - First bigint
 * @param b - Second bigint
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export const compareBigInt = (a: bigint, b: bigint): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

/**
 * Get minimum of two bigints
 */
export const minBigInt = (a: bigint, b: bigint): bigint => {
  return a < b ? a : b;
};

/**
 * Get maximum of two bigints
 */
export const maxBigInt = (a: bigint, b: bigint): bigint => {
  return a > b ? a : b;
};

export default {
  calculatePrice,
  calculateProgress,
  calculateMarketCap,
  parseU256,
  formatBigIntWithDecimals,
  toBigIntWithDecimals,
  safeDivide,
  compareBigInt,
  minBigInt,
  maxBigInt,
};

/**
 * Contract Service
 * Centralized service for interacting with Starknet contracts
 * Requirements: 1.2, 1.3, 1.4
 */

import { Contract, Account, RpcProvider, CallData, cairo, shortString } from 'starknet';
import { PUMP_FACTORY_ABI, BONDING_CURVE_POOL_ABI, MEMECOIN_TOKEN_ABI } from '../abi';
import { getContractConfig, getContractAddresses, isValidContractAddress, NetworkId } from '../config/contracts';

// ============================================================================
// Types
// ============================================================================

export interface LaunchParams {
  name: string;
  symbol: string;
  basePrice: bigint;
  slope: bigint;
  maxSupply: bigint;
  stealthCreator: string;
  migrationThreshold: bigint;
}

export interface LaunchResult {
  transactionHash: string;
  tokenAddress: string;
  poolAddress: string;
  launchId: bigint;
}

export interface PoolState {
  token: string;
  quoteToken: string;
  tokensSold: bigint;
  reserveBalance: bigint;
  migrated: boolean;
}

export interface PoolConfig {
  basePrice: bigint;
  slope: bigint;
  maxSupply: bigint;
}

export interface PublicLaunchInfo {
  token: string;
  pool: string;
  quoteToken: string;
  name: string;
  symbol: string;
  basePrice: bigint;
  slope: bigint;
  maxSupply: bigint;
  createdAt: bigint;
  migrated: boolean;
}

export interface TransactionResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  error?: string;
}

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

// ============================================================================
// Contract Service Class
// ============================================================================

export class ContractService {
  private provider: RpcProvider;

  private account: Account | null = null;

  private network: NetworkId;

  private pumpFactoryContract: Contract | null = null;

  constructor(network?: NetworkId) {
    this.network = network || 'sepolia';
    const config = getContractConfig(this.network);
    this.provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  }

  // =========================================================================
  // Account Management
  // =========================================================================

  /**
   * Set the connected account for transactions
   * Requirements: 1.2
   */
  setAccount(account: Account): void {
    this.account = account;
    // Reset cached contracts when account changes
    this.pumpFactoryContract = null;
  }

  /**
   * Get the current account
   */
  getAccount(): Account | null {
    return this.account;
  }

  /**
   * Check if an account is connected
   */
  isConnected(): boolean {
    return this.account !== null;
  }

  // =========================================================================
  // Contract Instance Creation
  // =========================================================================

  /**
   * Get PumpFactory contract instance
   * Requirements: 1.3
   */
  getPumpFactoryContract(): Contract {
    const addresses = getContractAddresses(this.network);
    
    if (!isValidContractAddress(addresses.pumpFactory)) {
      throw new Error('PumpFactory contract address not configured');
    }

    if (!this.pumpFactoryContract) {
      this.pumpFactoryContract = new Contract(
        PUMP_FACTORY_ABI,
        addresses.pumpFactory,
        this.account || this.provider
      );
    }

    return this.pumpFactoryContract;
  }

  /**
   * Get BondingCurvePool contract instance for a specific pool
   * Requirements: 1.3
   */
  getBondingCurvePoolContract(poolAddress: string): Contract {
    if (!isValidContractAddress(poolAddress)) {
      throw new Error('Invalid pool address');
    }

    return new Contract(
      BONDING_CURVE_POOL_ABI,
      poolAddress,
      this.account || this.provider
    );
  }

  /**
   * Get MemecoinToken contract instance for a specific token
   * Requirements: 1.3
   */
  getTokenContract(tokenAddress: string): Contract {
    if (!isValidContractAddress(tokenAddress)) {
      throw new Error('Invalid token address');
    }

    return new Contract(
      MEMECOIN_TOKEN_ABI,
      tokenAddress,
      this.account || this.provider
    );
  }

  // =========================================================================
  // PumpFactory Methods
  // =========================================================================

  /**
   * Create a new token launch
   * Requirements: 2.1
   */
  async createLaunch(params: LaunchParams): Promise<LaunchResult> {
    if (!this.account) {
      throw new Error('Account not connected');
    }

    const factory = this.getPumpFactoryContract();
    
    // Convert string to felt252 for name and symbol
    const nameAsFelt = shortString.encodeShortString(params.name);
    const symbolAsFelt = shortString.encodeShortString(params.symbol);

    const calldata = CallData.compile({
      name: nameAsFelt,
      symbol: symbolAsFelt,
      base_price: cairo.uint256(params.basePrice),
      slope: cairo.uint256(params.slope),
      max_supply: cairo.uint256(params.maxSupply),
      stealth_creator: params.stealthCreator,
      migration_threshold: cairo.uint256(params.migrationThreshold),
    });

    const tx = await factory.invoke('create_launch', calldata);
    
    // Wait for transaction confirmation
    const receipt = await this.waitForTransaction(tx.transaction_hash);
    
    // Extract addresses from events (LaunchCreated event)
    const launchEvent = this.extractLaunchCreatedEvent(receipt);
    
    return {
      transactionHash: tx.transaction_hash,
      tokenAddress: launchEvent?.token || '0x0',
      poolAddress: launchEvent?.pool || '0x0',
      launchId: launchEvent?.launchId || BigInt(0),
    };
  }

  /**
   * Get all launches from PumpFactory
   * Requirements: 3.1
   */
  async getAllLaunches(): Promise<PublicLaunchInfo[]> {
    const factory = this.getPumpFactoryContract();
    
    // Get total launches count
    const totalLaunches = await factory.call('total_launches');
    const count = BigInt(totalLaunches.toString());
    
    const launches: PublicLaunchInfo[] = [];
    
    // Fetch each launch
    // eslint-disable-next-line no-restricted-syntax
    for (let i = BigInt(0); i < count; i += BigInt(1)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const launch = await this.getLaunch(i);
        launches.push(launch);
      } catch (error) {
        console.error(`Failed to fetch launch ${i}:`, error);
      }
    }
    
    return launches;
  }

  /**
   * Get a specific launch by ID
   */
  async getLaunch(launchId: bigint | number): Promise<PublicLaunchInfo> {
    const factory = this.getPumpFactoryContract();
    const id = typeof launchId === 'number' ? BigInt(launchId) : launchId;
    
    const result = await factory.call('get_launch', [cairo.uint256(id)]);
    
    return this.parsePublicLaunchInfo(result);
  }

  /**
   * Get total number of launches
   */
  async getTotalLaunches(): Promise<bigint> {
    const factory = this.getPumpFactoryContract();
    const result = await factory.call('total_launches');
    return BigInt(result.toString());
  }

  // =========================================================================
  // BondingCurvePool Methods
  // =========================================================================

  /**
   * Get pool state
   * Requirements: 4.1
   */
  async getPoolState(poolAddress: string): Promise<PoolState> {
    const pool = this.getBondingCurvePoolContract(poolAddress);
    const result = await pool.call('get_state');
    
    return this.parsePoolState(result);
  }

  /**
   * Get pool configuration (base_price, slope, max_supply)
   */
  async getPoolConfig(poolAddress: string): Promise<PoolConfig> {
    const pool = this.getBondingCurvePoolContract(poolAddress);
    
    const [basePrice, slope, maxSupply] = await Promise.all([
      pool.call('base_price'),
      pool.call('slope'),
      pool.call('max_supply'),
    ]);

    return {
      basePrice: this.parseU256(basePrice),
      slope: this.parseU256(slope),
      maxSupply: this.parseU256(maxSupply),
    };
  }

  /**
   * Get current price from pool
   */
  async getCurrentPrice(poolAddress: string): Promise<bigint> {
    const pool = this.getBondingCurvePoolContract(poolAddress);
    const result = await pool.call('get_current_price');
    return this.parseU256(result);
  }

  /**
   * Get buy cost for a given amount of tokens
   * Requirements: 5.1
   * 
   * Calculates the cost using the bonding curve integral:
   * cost = base_price * amount + slope * (current_sold + amount)^2 / 2 - slope * current_sold^2 / 2
   */
  async getBuyCost(poolAddress: string, amountTokens: bigint): Promise<bigint> {
    const pool = this.getBondingCurvePoolContract(poolAddress);
    
    // Get current pool state and config
    const [state, basePrice, slope] = await Promise.all([
      pool.call('get_state'),
      pool.call('base_price'),
      pool.call('slope'),
    ]);
    
    const stateObj = this.parsePoolState(state);
    const tokensSold = stateObj.tokensSold;
    const base = this.parseU256(basePrice);
    const s = this.parseU256(slope);
    const amount = BigInt(amountTokens);
    
    // Calculate cost using bonding curve integral
    // cost = base_price * amount + slope * ((current + amount)^2 - current^2) / 2
    const currentSold = tokensSold;
    const newSold = currentSold + amount;
    
    // Linear component: base_price * amount
    const linearCost = base * amount;
    
    // Quadratic component: slope * (newSold^2 - currentSold^2) / 2
    const quadraticCost = (s * (newSold * newSold - currentSold * currentSold)) / BigInt(2);
    
    return linearCost + quadraticCost;
  }

  /**
   * Get sell return for a given amount of tokens
   * Requirements: 6.1
   * 
   * Calculates the return using the bonding curve integral:
   * return = base_price * amount + slope * current_sold^2 / 2 - slope * (current_sold - amount)^2 / 2
   */
  async getSellReturn(poolAddress: string, amountTokens: bigint): Promise<bigint> {
    const pool = this.getBondingCurvePoolContract(poolAddress);
    
    // Get current pool state and config
    const [state, basePrice, slope] = await Promise.all([
      pool.call('get_state'),
      pool.call('base_price'),
      pool.call('slope'),
    ]);
    
    const stateObj2 = this.parsePoolState(state);
    const tokensSold = stateObj2.tokensSold;
    const base = this.parseU256(basePrice);
    const s = this.parseU256(slope);
    const amount = BigInt(amountTokens);
    
    // Cannot sell more than what's been sold
    if (amount > tokensSold) {
      throw new Error('INSUFFICIENT_TOKENS_SOLD');
    }
    
    // Calculate return using bonding curve integral
    // return = base_price * amount + slope * (currentSold^2 - newSold^2) / 2
    const currentSold = tokensSold;
    const newSold = currentSold - amount;
    
    // Linear component: base_price * amount
    const linearReturn = base * amount;
    
    // Quadratic component: slope * (currentSold^2 - newSold^2) / 2
    const quadraticReturn = (s * (currentSold * currentSold - newSold * newSold)) / BigInt(2);
    
    return linearReturn + quadraticReturn;
  }

  /**
   * Buy tokens from bonding curve
   * Requirements: 5.2
   */
  async buy(poolAddress: string, amountTokens: bigint): Promise<TransactionResult> {
    if (!this.account) {
      throw new Error('Account not connected');
    }

    const pool = this.getBondingCurvePoolContract(poolAddress);
    
    const tx = await pool.invoke('buy', [cairo.uint256(amountTokens)]);
    
    return this.waitForTransaction(tx.transaction_hash);
  }

  /**
   * Sell tokens to bonding curve
   * Requirements: 6.2
   */
  async sell(poolAddress: string, amountTokens: bigint): Promise<TransactionResult> {
    if (!this.account) {
      throw new Error('Account not connected');
    }

    const pool = this.getBondingCurvePoolContract(poolAddress);
    
    const tx = await pool.invoke('sell', [cairo.uint256(amountTokens)]);
    
    return this.waitForTransaction(tx.transaction_hash);
  }

  // =========================================================================
  // Token Methods
  // =========================================================================

  /**
   * Get token balance for a user
   * Requirements: 9.1
   */
  async getBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
    const token = this.getTokenContract(tokenAddress);
    const result = await token.call('balance_of', [userAddress]);
    return this.parseU256(result);
  }

  /**
   * Approve token spending
   * Requirements: 5.2, 6.2
   */
  async approve(tokenAddress: string, spender: string, amount: bigint): Promise<TransactionResult> {
    if (!this.account) {
      throw new Error('Account not connected');
    }

    const token = this.getTokenContract(tokenAddress);
    
    const tx = await token.invoke('approve', [spender, cairo.uint256(amount)]);
    
    return this.waitForTransaction(tx.transaction_hash);
  }

  /**
   * Get token allowance
   */
  async getAllowance(tokenAddress: string, owner: string, spender: string): Promise<bigint> {
    const token = this.getTokenContract(tokenAddress);
    const result = await token.call('allowance', [owner, spender]);
    return this.parseU256(result);
  }

  // =========================================================================
  // Transaction Status Tracking
  // =========================================================================

  /**
   * Wait for transaction confirmation
   * Requirements: 1.4
   */
  async waitForTransaction(txHash: string): Promise<TransactionResult> {
    try {
      const receipt = await this.provider.waitForTransaction(txHash, {
        retryInterval: 2000,
      });

      const isSuccess = receipt.isSuccess();
      
      return {
        hash: txHash,
        status: isSuccess ? 'confirmed' : 'failed',
        blockNumber: (receipt as any).block_number,
        error: isSuccess ? undefined : 'Transaction reverted',
      };
    } catch (error) {
      return {
        hash: txHash,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get transaction status
   * Requirements: 1.4
   */
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return 'pending';
      }

      return receipt.isSuccess() ? 'confirmed' : 'failed';
    } catch {
      return 'pending';
    }
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Parse u256 from contract response
   */
  // eslint-disable-next-line class-methods-use-this
  private parseU256(value: any): bigint {
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'object' && 'low' in value && 'high' in value) {
      const low = BigInt(value.low.toString());
      const high = BigInt(value.high.toString());
      // eslint-disable-next-line no-bitwise
      return low + (high << BigInt(128));
    }
    return BigInt(value.toString());
  }

  /**
   * Parse PoolState from contract response
   */
  private parsePoolState(result: any): PoolState {
    return {
      token: result.token?.toString() || '0x0',
      quoteToken: result.quote_token?.toString() || '0x0',
      tokensSold: this.parseU256(result.tokens_sold),
      reserveBalance: this.parseU256(result.reserve_balance),
      migrated: Boolean(result.migrated),
    };
  }

  /**
   * Parse PublicLaunchInfo from contract response
   */
  private parsePublicLaunchInfo(result: any): PublicLaunchInfo {
    return {
      token: result.token?.toString() || '0x0',
      pool: result.pool?.toString() || '0x0',
      quoteToken: result.quote_token?.toString() || '0x0',
      name: shortString.decodeShortString(result.name?.toString() || '0x0'),
      symbol: shortString.decodeShortString(result.symbol?.toString() || '0x0'),
      basePrice: this.parseU256(result.base_price),
      slope: this.parseU256(result.slope),
      maxSupply: this.parseU256(result.max_supply),
      createdAt: BigInt(result.created_at?.toString() || '0'),
      migrated: Boolean(result.migrated),
    };
  }

  /**
   * Extract LaunchCreated event from transaction receipt
   */
  private extractLaunchCreatedEvent(receipt: any): { launchId: bigint; token: string; pool: string } | null {
    try {
      const events = receipt.events || [];
      
      const launchEvent = events.find((event: any) => event.keys && event.data);
      
      if (launchEvent) {
        // Event structure: launch_id (key), token, pool, stealth_creator, migration_threshold (data)
        return {
          launchId: this.parseU256(launchEvent.keys[0]),
          token: launchEvent.data[0]?.toString() || '0x0',
          pool: launchEvent.data[1]?.toString() || '0x0',
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let contractServiceInstance: ContractService | null = null;

/**
 * Get or create ContractService singleton
 */
export const getContractService = (network?: NetworkId): ContractService => {
  if (!contractServiceInstance) {
    contractServiceInstance = new ContractService(network);
  }
  return contractServiceInstance;
};

/**
 * Reset ContractService instance (useful for testing or network changes)
 */
export const resetContractService = (): void => {
  contractServiceInstance = null;
};

export default ContractService;

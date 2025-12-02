/**
 * Supabase Service
 * Handles all Supabase database and storage operations
 * Requirements: 8.2, 8.3, 8.5
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured, SUPABASE_CONFIG } from '../config/supabase';
import {
  TokenMetadata,
  TokenMetadataInsert,
  TokenMetadataUpdate,
  TradeEvent,
  TradeEventInsert,
  TradeEventFilter,
  TokenMetadataFilter,
} from '../@types/supabase';

// ===========================================
// Error Types
// ===========================================

export class SupabaseServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'SupabaseServiceError';
  }
}

// ===========================================
// Supabase Service Class
// ===========================================

export class SupabaseService {
  private client: SupabaseClient | null = null;

  /**
   * Get the Supabase client instance
   */
  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!isSupabaseConfigured()) {
        throw new SupabaseServiceError(
          'Supabase is not configured',
          'NOT_CONFIGURED'
        );
      }
      this.client = getSupabaseClient();
    }
    return this.client;
  }

  // ===========================================
  // Token Metadata Methods
  // ===========================================

  /**
   * Create a new token metadata record
   * Requirements: 8.2
   */
  async createTokenMetadata(metadata: TokenMetadataInsert): Promise<TokenMetadata> {
    const client = this.getClient();

    const { data, error } = await client
      .from(SUPABASE_CONFIG.tables.tokenMetadata)
      .insert(metadata)
      .select()
      .single();

    if (error) {
      throw new SupabaseServiceError(
        `Failed to create token metadata: ${error.message}`,
        'CREATE_FAILED',
        error
      );
    }

    return data as TokenMetadata;
  }

  /**
   * Get token metadata by token address
   * Requirements: 8.5 - Returns null gracefully if not found
   */
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata | null> {
    const client = this.getClient();

    const { data, error } = await client
      .from(SUPABASE_CONFIG.tables.tokenMetadata)
      .select('*')
      .eq('token_address', tokenAddress)
      .single();

    if (error) {
      // PGRST116 = Row not found - return null gracefully
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new SupabaseServiceError(
        `Failed to fetch token metadata: ${error.message}`,
        'FETCH_FAILED',
        error
      );
    }

    return data as TokenMetadata;
  }

  /**
   * Get all token metadata with optional filtering
   */
  async getAllTokenMetadata(filter?: TokenMetadataFilter): Promise<TokenMetadata[]> {
    const client = this.getClient();

    let query = client
      .from(SUPABASE_CONFIG.tables.tokenMetadata)
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filter?.creatorAddress) {
      query = query.eq('creator_address', filter.creatorAddress);
    }

    if (filter?.tags && filter.tags.length > 0) {
      query = query.overlaps('tags', filter.tags);
    }

    if (filter?.limit) {
      query = query.limit(filter.limit);
    }

    if (filter?.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new SupabaseServiceError(
        `Failed to fetch token metadata list: ${error.message}`,
        'FETCH_LIST_FAILED',
        error
      );
    }

    return (data || []) as TokenMetadata[];
  }

  /**
   * Update token metadata
   */
  async updateTokenMetadata(
    tokenAddress: string,
    updates: TokenMetadataUpdate
  ): Promise<TokenMetadata> {
    const client = this.getClient();

    const { data, error } = await client
      .from(SUPABASE_CONFIG.tables.tokenMetadata)
      .update(updates)
      .eq('token_address', tokenAddress)
      .select()
      .single();

    if (error) {
      throw new SupabaseServiceError(
        `Failed to update token metadata: ${error.message}`,
        'UPDATE_FAILED',
        error
      );
    }

    return data as TokenMetadata;
  }

  /**
   * Get multiple token metadata by addresses
   */
  async getTokenMetadataByAddresses(tokenAddresses: string[]): Promise<TokenMetadata[]> {
    if (tokenAddresses.length === 0) {
      return [];
    }

    const client = this.getClient();

    const { data, error } = await client
      .from(SUPABASE_CONFIG.tables.tokenMetadata)
      .select('*')
      .in('token_address', tokenAddresses);

    if (error) {
      throw new SupabaseServiceError(
        `Failed to fetch token metadata by addresses: ${error.message}`,
        'FETCH_BATCH_FAILED',
        error
      );
    }

    return (data || []) as TokenMetadata[];
  }

  // ===========================================
  // Image Upload Methods
  // ===========================================

  /**
   * Upload token image to Supabase Storage
   * Requirements: 8.3
   */
  async uploadTokenImage(file: File, tokenAddress?: string): Promise<string> {
    const client = this.getClient();

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = tokenAddress
      ? `${tokenAddress}.${fileExt}`
      : `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const filePath = `tokens/${fileName}`;

    const { error: uploadError } = await client.storage
      .from(SUPABASE_CONFIG.storage.tokenImagesBucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      throw new SupabaseServiceError(
        `Failed to upload token image: ${uploadError.message}`,
        'UPLOAD_FAILED',
        uploadError
      );
    }

    // Get public URL
    const { data: urlData } = client.storage
      .from(SUPABASE_CONFIG.storage.tokenImagesBucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  /**
   * Delete token image from storage
   */
  async deleteTokenImage(imageUrl: string): Promise<void> {
    const client = this.getClient();

    // Extract file path from URL
    const urlParts = imageUrl.split('/');
    const filePath = urlParts.slice(-2).join('/'); // tokens/filename.ext

    const { error } = await client.storage
      .from(SUPABASE_CONFIG.storage.tokenImagesBucket)
      .remove([filePath]);

    if (error) {
      throw new SupabaseServiceError(
        `Failed to delete token image: ${error.message}`,
        'DELETE_IMAGE_FAILED',
        error
      );
    }
  }

  // ===========================================
  // Trade Events Cache Methods
  // ===========================================

  /**
   * Cache a trade event
   */
  async cacheTradeEvent(event: TradeEventInsert): Promise<TradeEvent> {
    const client = this.getClient();

    const { data, error } = await client
      .from(SUPABASE_CONFIG.tables.tradeEvents)
      .insert(event)
      .select()
      .single();

    if (error) {
      // Ignore duplicate tx_hash errors (already cached)
      if (error.code === '23505') {
        const existing = await this.getTradeEventByTxHash(event.tx_hash);
        if (existing) return existing;
      }
      throw new SupabaseServiceError(
        `Failed to cache trade event: ${error.message}`,
        'CACHE_TRADE_FAILED',
        error
      );
    }

    return data as TradeEvent;
  }

  /**
   * Get trade event by transaction hash
   */
  async getTradeEventByTxHash(txHash: string): Promise<TradeEvent | null> {
    const client = this.getClient();

    const { data, error } = await client
      .from(SUPABASE_CONFIG.tables.tradeEvents)
      .select('*')
      .eq('tx_hash', txHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new SupabaseServiceError(
        `Failed to fetch trade event: ${error.message}`,
        'FETCH_TRADE_FAILED',
        error
      );
    }

    return data as TradeEvent;
  }

  /**
   * Get trade history for a pool with filtering
   */
  async getTradeHistory(filter: TradeEventFilter): Promise<TradeEvent[]> {
    const client = this.getClient();

    let query = client
      .from(SUPABASE_CONFIG.tables.tradeEvents)
      .select('*')
      .order('timestamp', { ascending: false });

    // Apply filters
    if (filter.poolAddress) {
      query = query.eq('pool_address', filter.poolAddress);
    }

    if (filter.trader) {
      query = query.eq('trader', filter.trader);
    }

    if (filter.tradeType) {
      query = query.eq('trade_type', filter.tradeType);
    }

    if (filter.startTime) {
      query = query.gte('timestamp', filter.startTime.toISOString());
    }

    if (filter.endTime) {
      query = query.lte('timestamp', filter.endTime.toISOString());
    }

    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    if (filter.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new SupabaseServiceError(
        `Failed to fetch trade history: ${error.message}`,
        'FETCH_HISTORY_FAILED',
        error
      );
    }

    return (data || []) as TradeEvent[];
  }

  /**
   * Batch cache multiple trade events
   */
  async batchCacheTradeEvents(events: TradeEventInsert[]): Promise<number> {
    if (events.length === 0) return 0;

    const client = this.getClient();

    const { data, error } = await client
      .from(SUPABASE_CONFIG.tables.tradeEvents)
      .upsert(events, { onConflict: 'tx_hash', ignoreDuplicates: true })
      .select();

    if (error) {
      throw new SupabaseServiceError(
        `Failed to batch cache trade events: ${error.message}`,
        'BATCH_CACHE_FAILED',
        error
      );
    }

    return data?.length || 0;
  }
}

// ===========================================
// Singleton Instance
// ===========================================

let supabaseServiceInstance: SupabaseService | null = null;

export const getSupabaseService = (): SupabaseService => {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = new SupabaseService();
  }
  return supabaseServiceInstance;
};

export const resetSupabaseService = (): void => {
  supabaseServiceInstance = null;
};

export default SupabaseService;

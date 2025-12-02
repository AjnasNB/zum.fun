import sum from 'lodash/sum';
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';
import { createSlice, Dispatch, PayloadAction } from '@reduxjs/toolkit';
import { paramCase } from 'change-case';
// utils
import { IDN404MetaDataState, ICheckoutCartItem, IDN404MetaData } from '../../@types/DN404';
// services
import { getContractService, PublicLaunchInfo, PoolState } from '../../services/contractService';
import { getSupabaseService } from '../../services/supabaseService';
import { TokenMetadata } from '../../@types/supabase';
// utils
import { calculatePrice, calculateProgress, calculateMarketCap } from '../../hooks/useTokenList';

// Default placeholder image for tokens without images
const DEFAULT_TOKEN_IMAGE = '/assets/placeholder.svg';

// ----------------------------------------------------------------------

// Cache for on-chain data
interface OnChainCache {
  launches: PublicLaunchInfo[];
  poolStates: Map<string, PoolState>;
  lastFetched: number;
}

let onChainCache: OnChainCache = {
  launches: [],
  poolStates: new Map(),
  lastFetched: 0,
};

const CACHE_TTL = 30000; // 30 seconds

const initialState: IDN404MetaDataState = {
  isLoading: false,
  error: null,
  products: [],
  product: null,
  checkout: {
    activeStep: 0,
    cart: [],
    subtotal: 0,
    total: 0,
    discount: 0,
    shipping: 0,
    billing: null,
    totalItems: 0,
  },
};

const slice = createSlice({
  name: 'product',
  initialState,
  reducers: {
    // START LOADING
    startLoading(state) {
      state.isLoading = true;
    },

    // HAS ERROR
    hasError(state, action) {
      state.isLoading = false;
      state.error = action.payload;
    },

    // GET PRODUCTS
    getProductsSuccess(state, action) {
      state.isLoading = false;
      state.products = action.payload;
    },

    // GET PRODUCT
    getProductSuccess(state, action) {
      state.isLoading = false;
      state.product = action.payload;
    },

    // ADD NEW PRODUCT (for real-time updates)
    addProduct(state, action: PayloadAction<IDN404MetaData>) {
      state.products = [action.payload, ...state.products];
    },

    // UPDATE PRODUCT (for real-time price updates)
    updateProduct(state, action: PayloadAction<{ id: string; updates: Partial<IDN404MetaData> }>) {
      const index = state.products.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.products[index] = { ...state.products[index], ...action.payload.updates };
      }
    },

    // CHECKOUT
    getCart(state, action) {
      const cart: ICheckoutCartItem[] = action.payload;

      const totalItems = sum(cart.map((product) => product.quantity));
      const subtotal = sum(cart.map((product) => product.price * product.quantity));
      state.checkout.cart = cart;
      state.checkout.discount = state.checkout.discount || 0;
      state.checkout.shipping = state.checkout.shipping || 0;
      state.checkout.billing = state.checkout.billing || null;
      state.checkout.subtotal = subtotal;
      state.checkout.total = subtotal - state.checkout.discount;
      state.checkout.totalItems = totalItems;
    },

    addToCart(state, action) {
      const newProduct = action.payload;
      const isEmptyCart = !state.checkout.cart.length;

      if (isEmptyCart) {
        state.checkout.cart = [...state.checkout.cart, newProduct];
      } else {
        state.checkout.cart = state.checkout.cart.map((product) => {
          const isExisted = product.id === newProduct.id;

          if (isExisted) {
            return {
              ...product,
              colors: uniq([...product.colors, ...newProduct.colors]),
              quantity: product.quantity + 1,
            };
          }

          return product;
        });
      }
      state.checkout.cart = uniqBy([...state.checkout.cart, newProduct], 'id');
      state.checkout.totalItems = sum(state.checkout.cart.map((product) => product.quantity));
    },

    deleteCart(state, action) {
      const updateCart = state.checkout.cart.filter((product) => product.id !== action.payload);

      state.checkout.cart = updateCart;
    },

    resetCart(state) {
      state.checkout.cart = [];
      state.checkout.billing = null;
      state.checkout.activeStep = 0;
      state.checkout.total = 0;
      state.checkout.subtotal = 0;
      state.checkout.discount = 0;
      state.checkout.shipping = 0;
      state.checkout.totalItems = 0;
    },

    backStep(state) {
      state.checkout.activeStep -= 1;
    },

    nextStep(state) {
      state.checkout.activeStep += 1;
    },

    gotoStep(state, action) {
      const step = action.payload;
      state.checkout.activeStep = step;
    },

    increaseQuantity(state, action) {
      const productId = action.payload;

      const updateCart = state.checkout.cart.map((product) => {
        if (product.id === productId) {
          return {
            ...product,
            quantity: product.quantity + 1,
          };
        }
        return product;
      });

      state.checkout.cart = updateCart;
    },

    decreaseQuantity(state, action) {
      const productId = action.payload;
      const updateCart = state.checkout.cart.map((product) => {
        if (product.id === productId) {
          return {
            ...product,
            quantity: product.quantity - 1,
          };
        }
        return product;
      });

      state.checkout.cart = updateCart;
    },

    createBilling(state, action) {
      state.checkout.billing = action.payload;
    },

    applyDiscount(state, action) {
      const discount = action.payload;
      state.checkout.discount = discount;
      state.checkout.total = state.checkout.subtotal - discount;
    },

    applyShipping(state, action) {
      const shipping = action.payload;
      state.checkout.shipping = shipping;
      state.checkout.total = state.checkout.subtotal - state.checkout.discount + shipping;
    },

    // Clear cache
    clearCache() {
      onChainCache = {
        launches: [],
        poolStates: new Map(),
        lastFetched: 0,
      };
    },
  },
});

// Reducer
export default slice.reducer;

// Actions
export const {
  getCart,
  addToCart,
  resetCart,
  gotoStep,
  backStep,
  nextStep,
  deleteCart,
  createBilling,
  applyShipping,
  applyDiscount,
  increaseQuantity,
  decreaseQuantity,
  addProduct,
  updateProduct,
  clearCache,
} = slice.actions;

// ----------------------------------------------------------------------

/**
 * Convert on-chain launch data to IDN404MetaData format
 */
function convertLaunchToProduct(
  launch: PublicLaunchInfo,
  poolState: PoolState | null,
  metadata: TokenMetadata | null,
  index: number
): IDN404MetaData {
  const tokensSold = poolState?.tokensSold || BigInt(0);
  const currentPrice = calculatePrice(launch.basePrice, launch.slope, tokensSold);
  const progress = calculateProgress(tokensSold, launch.maxSupply);
  const marketCap = calculateMarketCap(currentPrice, tokensSold);

  // Convert bigint to number for display (with scaling)
  const priceNumber = Number(currentPrice) / 1e18;
  const marketCapNumber = Number(marketCap) / 1e36; // price * tokens, both scaled

  // Use metadata image or default placeholder
  const imageUrl = metadata?.image_url || DEFAULT_TOKEN_IMAGE;

  return {
    id: launch.token,
    coverUrl: imageUrl,
    images: [imageUrl],
    price: priceNumber,
    code: launch.symbol,
    sku: launch.token.slice(0, 16),
    tags: metadata?.tags || [],
    priceSale: null,
    totalRating: 0,
    totalReview: 0,
    ratings: [],
    reviews: [],
    colors: ['#00AB55', '#1890FF'],
    status: poolState?.migrated ? 'migrated' : 'active',
    inventoryType: poolState?.migrated ? 'Migrated' : 'In Progress',
    sizes: [],
    available: Number(launch.maxSupply - tokensSold),
    description: metadata?.description || '',
    sold: Number(tokensSold),
    createdAt: metadata?.created_at || new Date(Number(launch.createdAt) * 1000).toISOString(),
    category: 'Token',
    gender: 'Unisex',
    // Zump.fun specific fields
    name: metadata?.name || launch.name || 'Unknown Token',
    symbol: metadata?.symbol || launch.symbol || '???',
    wallet: metadata?.creator_address || '0x0',
    contract: launch.token,
    bondingCurveProccess: progress,
    marketCap: marketCapNumber,
    holdersCount: 0, // Would need separate query
    totalDeposit: Number(poolState?.reserveBalance || BigInt(0)) / 1e18,
    // Privacy features
    isPrivate: !poolState?.migrated,
    isMigrated: poolState?.migrated || false,
    stealthLaunch: true,
    creatorRevealed: false,
    privacyLevel: poolState?.migrated ? 'public' : 'stealth',
  };
}

/**
 * Fetch products from on-chain data
 * Requirements: 3.1, 3.4
 */
export function getProducts(forceRefresh = false) {
  return async (dispatch: Dispatch) => {
    dispatch(slice.actions.startLoading());

    try {
      const now = Date.now();
      const useCache = !forceRefresh && onChainCache.lastFetched > 0 && now - onChainCache.lastFetched < CACHE_TTL;

      let launches: PublicLaunchInfo[];
      let poolStates: Map<string, PoolState>;

      if (useCache) {
        launches = onChainCache.launches;
        poolStates = onChainCache.poolStates;
      } else {
        const contractService = getContractService();

        // Fetch all launches from PumpFactory
        launches = await contractService.getAllLaunches();

        // Fetch pool states for each launch
        poolStates = new Map();
        const poolStatePromises = launches.map(async (launch) => {
          try {
            const state = await contractService.getPoolState(launch.pool);
            poolStates.set(launch.pool, state);
          } catch (err) {
            console.error(`Failed to fetch pool state for ${launch.pool}:`, err);
          }
        });

        await Promise.all(poolStatePromises);

        // Update cache
        onChainCache = {
          launches,
          poolStates,
          lastFetched: now,
        };
      }

      // If no on-chain data, return empty list
      if (launches.length === 0) {
        console.log('No on-chain launches found');
        dispatch(slice.actions.getProductsSuccess([]));
        return;
      }

      // Fetch metadata from Supabase
      let metadataMap: Map<string, TokenMetadata> = new Map();
      try {
        const supabaseService = getSupabaseService();
        const tokenAddresses = launches.map((l) => l.token);
        const metadataList = await supabaseService.getTokenMetadataByAddresses(tokenAddresses);
        metadataMap = new Map(metadataList.map((m) => [m.token_address, m]));
      } catch (err) {
        console.warn('Failed to fetch metadata from Supabase:', err);
      }

      // Convert to products
      const products = launches.map((launch, index) => {
        const poolState = poolStates.get(launch.pool) || null;
        const metadata = metadataMap.get(launch.token) || null;
        return convertLaunchToProduct(launch, poolState, metadata, index);
      });

      // Sort by creation date (newest first)
      products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      dispatch(slice.actions.getProductsSuccess(products));
    } catch (error) {
      console.error('Failed to fetch products:', error);
      dispatch(slice.actions.hasError(error));
      // Return empty list on error - no mock data fallback
      dispatch(slice.actions.getProductsSuccess([]));
    }
  };
}

// ----------------------------------------------------------------------

/**
 * Fetch single product by name/slug
 */
export function getProduct(name: string) {
  return async (dispatch: Dispatch) => {
    dispatch(slice.actions.startLoading());
    try {
      const contractService = getContractService();

      // First try to find in cache
      if (onChainCache.launches.length > 0) {
        const launch = onChainCache.launches.find(
          (l) => paramCase(l.name) === name || l.token === name
        );

        if (launch) {
          const poolState = onChainCache.poolStates.get(launch.pool) || null;

          // Fetch metadata
          let metadata: TokenMetadata | null = null;
          try {
            const supabaseService = getSupabaseService();
            metadata = await supabaseService.getTokenMetadata(launch.token);
          } catch (err) {
            console.warn('Failed to fetch metadata:', err);
          }

          const product = convertLaunchToProduct(launch, poolState, metadata, 0);
          dispatch(slice.actions.getProductSuccess(product));
          return;
        }
      }

      // Fetch all launches and find the matching one
      const launches = await contractService.getAllLaunches();
      const launch = launches.find((l) => paramCase(l.name) === name || l.token === name);

      if (!launch) {
        throw new Error(`Token not found: ${name}`);
      }

      // Fetch pool state
      let poolState: PoolState | null = null;
      try {
        poolState = await contractService.getPoolState(launch.pool);
      } catch (err) {
        console.error('Failed to fetch pool state:', err);
      }

      // Fetch metadata
      let metadata: TokenMetadata | null = null;
      try {
        const supabaseService = getSupabaseService();
        metadata = await supabaseService.getTokenMetadata(launch.token);
      } catch (err) {
        console.warn('Failed to fetch metadata:', err);
      }

      const product = convertLaunchToProduct(launch, poolState, metadata, 0);
      dispatch(slice.actions.getProductSuccess(product));
    } catch (error) {
      console.error(error);
      dispatch(slice.actions.hasError(error));
    }
  };
}

// ----------------------------------------------------------------------

/**
 * Subscribe to new launch events for real-time updates
 * Requirements: 3.4
 */
export function subscribeToNewLaunches() {
  return async (dispatch: Dispatch) => {
    // Note: Real-time event subscription would require WebSocket connection
    // to Starknet node or indexer service. For now, we use polling.
    console.log('Real-time subscription not yet implemented - using polling');

    // Poll every 30 seconds for new launches
    const pollInterval = setInterval(async () => {
      try {
        const contractService = getContractService();
        const currentCount = onChainCache.launches.length;
        const newCount = await contractService.getTotalLaunches();

        if (Number(newCount) > currentCount) {
          // New launches detected, refresh the list
          dispatch(getProducts(true) as any);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 30000);

    // Return cleanup function
    return () => clearInterval(pollInterval);
  };
}

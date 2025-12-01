// ----------------------------------------------------------------------

export type IDN404MetaDataReview = {
  id: string;
  name: string;
  avatarUrl: string;
  comment: string;
  rating: number;
  isPurchased: boolean;
  helpful: number;
  postedAt: Date | string | number;
};

export type IDN404MetaData = {
  id: string;
  coverUrl: string;
  images: string[];
  price: number;
  code: string;
  sku: string;
  tags: string[];
  priceSale: number | null;
  totalRating: number;
  totalReview: number;
  ratings: {
    name: string;
    starCount: number;
    reviewCount: number;
  }[];
  reviews: IDN404MetaDataReview[];
  colors: string[];
  status: string;
  inventoryType: string;
  sizes: string[];
  available: number;
  description: string;
  sold: number;
  createdAt: Date | string | number;
  category: string;
  gender: string;
  // Zump.fun Privacy Memecoin
  name: string;
  symbol: string;
  wallet: string; // Stealth wallet address (unlinkable)
  contract?: string;
  bondingCurveProccess?: number;
  marketCap?: number;
  holdersCount?: number; // Encrypted holder count
  totalDeposit?: number;
  // Privacy features
  isPrivate?: boolean; // Whether trading is still private
  isMigrated?: boolean; // Whether migrated to public DEX
  stealthLaunch?: boolean; // Launched via stealth address
  creatorRevealed?: boolean; // Has creator self-revealed
  privacyLevel?: 'ghost' | 'stealth' | 'public'; // Privacy status
};

export type IDN404MetaDataFilter = {
  gender: string[];
  category: string;
  colors: string[];
  priceRange: number[];
  rating: string;
  sortBy: string;
};

// ----------------------------------------------------------------------

export type ICheckoutCartItem = {
  id: string;
  name: string;
  cover: string;
  available: number;
  price: number;
  colors: string[];
  size: string;
  quantity: number;
  subtotal: number;
};

export type ICheckoutBillingAddress = {
  receiver: string;
  phoneNumber: string;
  fullAddress: string;
  addressType: string;
  isDefault: boolean;
};

export type ICheckoutDeliveryOption = {
  value: number;
  title: string;
  description: string;
};

export type ICheckoutPaymentOption = {
  value: string;
  title: string;
  description: string;
  icons: string[];
};

export type ICheckoutCardOption = {
  value: string;
  label: string;
};

// ----------------------------------------------------------------------

export type IDN404MetaDataCheckoutState = {
  activeStep: number;
  cart: ICheckoutCartItem[];
  subtotal: number;
  total: number;
  discount: number;
  shipping: number;
  billing: ICheckoutBillingAddress | null;
  totalItems: number;
};

export type IDN404MetaDataState = {
  isLoading: boolean;
  error: Error | string | null;
  products: IDN404MetaData[];
  product: IDN404MetaData | null;
  checkout: IDN404MetaDataCheckoutState;
};

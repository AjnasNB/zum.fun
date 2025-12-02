import { sentenceCase } from 'change-case';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// form
import { useForm } from 'react-hook-form';
// @mui
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
// routes
import { alpha, styled, useTheme } from '@mui/material/styles';
import { Box } from '@mui/system';
import Lightbox from 'src/components/lightbox';
import { Notpump_DEFINE_FAIRLAUNCH } from 'src/descriptions/DN404';
import useResponsive from 'src/hooks/useResponsive';
import { PATH_DASHBOARD } from '../../../../routes/paths';
// utils
import { formatBigIntWithDecimals, toBigIntWithDecimals } from '../../../../utils/bondingCurveUtils';
// @types
import { ICheckoutCartItem, IDN404MetaData } from '../../../../@types/DN404';
// _mock
import { _socials } from '../../../../_mock/arrays';
// components
import FormProvider, { RHFTextField } from '../../../../components/hook-form';
import Iconify from '../../../../components/iconify';
import Label from '../../../../components/label';
// hooks
import { useTrading } from '../../../../hooks/useTrading';
// @mui
// utils
import { bgGradient } from '../../../../utils/cssStyles';
// @types
// components
import Carousel from '../../../../components/carousel';
import Image from '../../../../components/image';
import { DN404DerivativeChart } from '../../general/e-commerce';
import { AppWidgetSummary } from '../../general/app';

const THUMB_SIZE = 64;

type StyledThumbnailsContainerProps = {
  length: number;
};

const StyledThumbnailsContainer = styled('div', {
  shouldForwardProp: (prop) => prop !== 'length',
})<StyledThumbnailsContainerProps>(({ length, theme }) => ({
  margin: theme.spacing(0, 'auto'),
  position: 'relative',

  '& .slick-slide': {
    opacity: 0.48,
    '&.slick-current': {
      opacity: 1,
    },
    '& > div': {
      padding: theme.spacing(0, 0.75),
    },
  },

  ...(length === 1 && {
    maxWidth: THUMB_SIZE * 1 + 16,
  }),
  ...(length === 2 && {
    maxWidth: THUMB_SIZE * 2 + 32,
  }),
  ...((length === 3 || length === 4) && {
    maxWidth: THUMB_SIZE * 3 + 48,
  }),
  ...(length >= 5 && {
    maxWidth: THUMB_SIZE * 6,
  }),
  ...(length > 2 && {
    '&:before, &:after': {
      ...bgGradient({
        direction: 'to left',
        startColor: `${alpha(theme.palette.background.default, 0)} 0%`,
        endColor: `${theme.palette.background.default} 100%`,
      }),
      top: 0,
      zIndex: 9,
      content: "''",
      height: '100%',
      position: 'absolute',
      width: (THUMB_SIZE * 2) / 3,
    },
    '&:after': {
      right: 0,
      transform: 'scaleX(-1)',
    },
  }),
}));
// ----------------------------------------------------------------------

interface FormValuesProps extends Omit<ICheckoutCartItem, 'colors'> {
  colors: string;
}

// Constants
const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];
const DEFAULT_SLIPPAGE = 1;
const DECIMALS = 18;

type Props = {
  product: IDN404MetaData;
  cart: ICheckoutCartItem[];
  onAddCart: (cartItem: ICheckoutCartItem) => void;
  onGotoStep: (step: number) => void;
  // On-chain trading props
  poolAddress?: string;
  tokenAddress?: string;
  currentPrice?: bigint;
  isMigrated?: boolean;
  onTradeSuccess?: () => void;
};
export default function DN404DetailsSummary({
  cart,
  product,
  onAddCart,
  onGotoStep,
  poolAddress,
  tokenAddress,
  currentPrice,
  isMigrated = false,
  onTradeSuccess,
  ...other
}: Props) {
  const navigate = useNavigate();

  const {
    id,
    name,
    sizes,
    price,
    coverUrl,
    status,
    colors,
    available,
    priceSale,
    totalRating,
    totalReview,
    inventoryType,
  } = product;

  const alreadyProduct = cart.map((item) => item.id).includes(id);

  const isMaxQuantity =
    cart.filter((item) => item.id === id).map((item) => item.quantity)[0] >= available;

  const defaultValues = {
    id,
    name,
    coverUrl,
    available,
    price,
    colors: colors[0],
    size: sizes[4],
    quantity: available < 1 ? 0 : 1,
  };

  const methods = useForm<FormValuesProps>({
    defaultValues,
  });

  const { reset, watch, control, setValue, handleSubmit } = methods;

  const values = watch();

  useEffect(() => {
    if (product) {
      reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const onSubmit = async (data: FormValuesProps) => {
    try {
      if (!alreadyProduct) {
        onAddCart({
          ...data,
          colors: [values.colors],
          subtotal: data.price * data.quantity,
        });
      }
      onGotoStep(0);
      navigate(PATH_DASHBOARD.dn404.checkout);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddCart = async () => {
    try {
      onAddCart({
        ...values,
        colors: [values.colors],
        subtotal: values.price * values.quantity,
      });
    } catch (error) {
      console.error(error);
    }
  };

  // ===========================================
  // On-Chain Trading State & Logic
  // Requirements: 5.3, 6.3, 6.4
  // ===========================================
  
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [calculatedValue, setCalculatedValue] = useState<bigint | null>(null);
  const [isCalculatingValue, setIsCalculatingValue] = useState(false);
  const [currentTabTrade, setCurrentTabTrade] = useState<'trade' | 'derivative'>('trade');

  // Use trading hook if pool and token addresses are provided
  const tradingEnabled = Boolean(poolAddress && tokenAddress);
  
  const {
    getBuyCost,
    getSellReturn,
    buy,
    sell,
    isBuying,
    isSelling,
    error: tradingError,
    clearError,
    userTokenBalance,
    userQuoteBalance,
    refreshBalances,
  } = useTrading({
    poolAddress: poolAddress || '',
    tokenAddress: tokenAddress || '',
    onSuccess: () => {
      setTradeAmount('');
      setCalculatedValue(null);
      onTradeSuccess?.();
    },
  });

  // Refresh balances on mount when trading is enabled
  useEffect(() => {
    if (tradingEnabled) {
      refreshBalances();
    }
  }, [tradingEnabled, refreshBalances]);

  // Calculate cost/return when amount changes
  useEffect(() => {
    if (!tradingEnabled) return;
    
    const calculateValue = async () => {
      if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
        setCalculatedValue(null);
        return;
      }

      setIsCalculatingValue(true);
      try {
        const amountBigInt = toBigIntWithDecimals(tradeAmount, DECIMALS);
        
        if (currentTabTrade === 'trade') {
          // For buy tab
          const cost = await getBuyCost(amountBigInt);
          setCalculatedValue(cost);
        }
      } catch (err) {
        console.error('Failed to calculate value:', err);
        setCalculatedValue(null);
      } finally {
        setIsCalculatingValue(false);
      }
    };

    const timeoutId = setTimeout(calculateValue, 300);
    return () => clearTimeout(timeoutId);
  }, [tradeAmount, currentTabTrade, tradingEnabled, getBuyCost]);

  // Handle trade amount change
  const handleTradeAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setTradeAmount(value);
      clearError();
    }
  };

  // Handle max button click
  const handleMaxClick = () => {
    if (userQuoteBalance) {
      setTradeAmount(formatBigIntWithDecimals(userQuoteBalance, DECIMALS, 6));
    }
  };

  // Handle buy execution
  // Requirements: 5.2, 5.3
  const handleBuy = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0 || !tradingEnabled) return;

    const amountBigInt = toBigIntWithDecimals(tradeAmount, DECIMALS);
    const slippageMultiplier = BigInt(Math.floor((100 + slippage) * 100));
    const slippageDivisor = BigInt(10000);

    try {
      const maxCost = calculatedValue 
        ? (calculatedValue * slippageMultiplier) / slippageDivisor
        : undefined;
      await buy(amountBigInt, maxCost);
    } catch (err) {
      console.error('Buy failed:', err);
    }
  };

  // Handle sell execution
  // Requirements: 6.2, 6.3, 6.4
  const handleSell = async () => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0 || !tradingEnabled) return;

    const amountBigInt = toBigIntWithDecimals(tradeAmount, DECIMALS);
    const minSlippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
    const slippageDivisor = BigInt(10000);

    try {
      const expectedReturn = await getSellReturn(amountBigInt);
      const minReturn = (expectedReturn * minSlippageMultiplier) / slippageDivisor;
      await sell(amountBigInt, minReturn);
    } catch (err) {
      console.error('Sell failed:', err);
    }
  };

  // Check if sell is disabled (no balance)
  // Requirements: 6.4
  const isSellDisabled = useMemo(() => {
    if (isMigrated) return true;
    if (!tradingEnabled) return false; // Fall back to mock behavior
    if (userTokenBalance === null || userTokenBalance === BigInt(0)) return true;
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) return true;
    
    const amountBigInt = toBigIntWithDecimals(tradeAmount, DECIMALS);
    return amountBigInt > userTokenBalance;
  }, [isMigrated, tradingEnabled, userTokenBalance, tradeAmount]);

  // Check if buy is disabled
  const isBuyDisabled = useMemo(() => {
    if (isMigrated) return true;
    if (!tradingEnabled) return false; // Fall back to mock behavior
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) return true;
    if (isBuying || isSelling) return true;
    return false;
  }, [isMigrated, tradingEnabled, tradeAmount, isBuying, isSelling]);

  const theme = useTheme();
  const isDesktop = useResponsive('up', 'md');

  const carousel1 = useRef<Carousel | null>(null);

  const carousel2 = useRef<Carousel | null>(null);

  const [nav1, setNav1] = useState<Carousel>();

  const [nav2, setNav2] = useState<Carousel>();

  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedImage, setSelectedImage] = useState<number>(-1);

  const imagesLightbox = product.images.map((img) => ({ src: img }));

  const handleOpenLightbox = (imageUrl: string) => {
    const imageIndex = imagesLightbox.findIndex((image) => image.src === imageUrl);
    setSelectedImage(imageIndex);
  };

  const handleCloseLightbox = () => {
    setSelectedImage(-1);
  };

  const carouselSettings2 = {
    dots: false,
    arrows: false,
    centerMode: true,
    swipeToSlide: true,
    focusOnSelect: true,
    variableWidth: true,
    centerPadding: '0px',
    slidesToShow: product.images.length > 3 ? 3 : product.images.length,
  };

  useEffect(() => {
    if (carousel1.current) {
      setNav1(carousel1.current);
    }
    if (carousel2.current) {
      setNav2(carousel2.current);
    }
  }, []);

  useEffect(() => {
    carousel1.current?.slickGoTo(currentIndex);
  }, [currentIndex]);

  const tokenSymbol = product.name.split(' ')[0].toUpperCase();
  
  const TABS = [
    {
      value: 'trade',
      label: 'Trade',
      component: (
        <Stack>
          {/* Migrated Warning - Requirements: 6.5 */}
          {isMigrated && (
            <Alert 
              severity="warning" 
              sx={{ mb: 2 }}
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={() => window.open('https://app.avnu.fi', '_blank')}
                >
                  DEX&apos;e Git
                </Button>
              }
            >
              Bu havuz DEX&apos;e taşınmış. Lütfen DEX üzerinden işlem yapın.
            </Alert>
          )}

          {/* Trading Error Display */}
          {tradingError && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={clearError}
            >
              {tradingError.message}
            </Alert>
          )}

          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">
                {tokenSymbol} / ETH
              </Typography>
              {currentPrice !== undefined && currentPrice !== null && (
                <Typography variant="caption" color="text.secondary">
                  Price: {formatBigIntWithDecimals(currentPrice, DECIMALS, 8)} ETH
                </Typography>
              )}
            </Stack>

            {/* Token Amount Input */}
            <Stack spacing={1}>
              <Typography
                variant="caption"
                component="div"
                sx={{ textAlign: 'right', color: 'text.secondary', cursor: 'pointer' }}
                onClick={handleMaxClick}
              >
                ETH Balance: {tradingEnabled && userQuoteBalance 
                  ? formatBigIntWithDecimals(userQuoteBalance, DECIMALS, 4) 
                  : '0.00'}
              </Typography>
              <TextField
                size="small"
                type="text"
                value={tradeAmount}
                onChange={handleTradeAmountChange}
                label={`${tokenSymbol} amount`}
                placeholder="0"
                disabled={isMigrated}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button 
                        size="small" 
                        onClick={handleMaxClick}
                        disabled={isMigrated}
                      >
                        MAX
                      </Button>
                    </InputAdornment>
                  ),
                }}
                sx={{ width: '100%' }}
              />
            </Stack>

            {/* Swap Icon */}
            <Stack spacing={1} sx={{ pt: 1 }}>
              <div style={{ width: '100%', textAlign: 'center' }}>
                <IconButton sx={{ height: 40, width: 40 }}>⇅</IconButton>
              </div>
            </Stack>

            {/* Calculated Cost/Return Display */}
            <Stack spacing={1}>
              <Typography
                variant="caption"
                component="div"
                sx={{ textAlign: 'right', color: 'text.secondary' }}
              >
                {tokenSymbol} Balance: {tradingEnabled && userTokenBalance 
                  ? formatBigIntWithDecimals(userTokenBalance, DECIMALS, 2) 
                  : '0'}
              </Typography>
              <TextField
                size="small"
                type="text"
                value={calculatedValue ? formatBigIntWithDecimals(calculatedValue, DECIMALS, 6) : ''}
                label="Cost (ETH)"
                placeholder="0"
                disabled
                InputProps={{
                  readOnly: true,
                  endAdornment: isCalculatingValue ? (
                    <InputAdornment position="end">
                      <CircularProgress size={16} />
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ width: '100%' }}
              />
            </Stack>

            {/* Slippage Settings */}
            <Stack 
              direction="row" 
              alignItems="center" 
              justifyContent="space-between"
              sx={{ cursor: 'pointer', pt: 1 }}
              onClick={() => setShowSlippageSettings(!showSlippageSettings)}
            >
              <Typography variant="caption" color="text.secondary">
                Slippage Tolerance
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="caption" fontWeight="bold">
                  {slippage}%
                </Typography>
                <Iconify 
                  icon={showSlippageSettings ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'} 
                  width={16}
                />
              </Stack>
            </Stack>

            {showSlippageSettings && (
              <Box sx={{ pt: 1 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  {SLIPPAGE_OPTIONS.map((option) => (
                    <Button
                      key={option}
                      size="small"
                      variant={slippage === option ? 'contained' : 'outlined'}
                      onClick={() => setSlippage(option)}
                      sx={{ minWidth: 40, fontSize: '0.7rem' }}
                    >
                      {option}%
                    </Button>
                  ))}
                </Stack>
                <Slider
                  value={slippage}
                  onChange={(_, value) => setSlippage(value as number)}
                  min={0.1}
                  max={10}
                  step={0.1}
                  size="small"
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                />
              </Box>
            )}
          </Stack>

          {/* Buy/Sell Buttons - Requirements: 5.3, 6.3, 6.4 */}
          <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
            <Button
              fullWidth
              disabled={isBuyDisabled}
              size="large"
              color="success"
              variant="contained"
              onClick={tradingEnabled ? handleBuy : handleAddCart}
              sx={{ whiteSpace: 'nowrap' }}
              startIcon={isBuying && <CircularProgress size={16} color="inherit" />}
            >
              {isBuying ? 'Buying...' : 'Buy'}
            </Button>

            <Button 
              fullWidth 
              color="error" 
              size="large" 
              variant="contained"
              disabled={isSellDisabled}
              onClick={tradingEnabled ? handleSell : undefined}
              startIcon={isSelling && <CircularProgress size={16} color="inherit" />}
            >
              {isSelling ? 'Selling...' : (isSellDisabled && tradingEnabled ? 'No Balance' : 'Sell')}
            </Button>
          </Stack>
        </Stack>
      ),
    },
    {
      value: 'derivative',
      label: `Derivative`,
      component: (
        <Stack>
          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">
                {product.name.split(' ')[0].toUpperCase()} / ETH
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Number(Math.random().toFixed(2)) * 100}
                sx={{
                  mx: 2,
                  flexGrow: 1,
                  mr: 0.5,
                }}
              />
            </Stack>

            <Stack spacing={1}>
              <Typography
                variant="caption"
                component="div"
                sx={{ textAlign: 'right', color: 'text.secondary', cursor: 'pointer' }}
              >
                ETH Balance: 1,23
              </Typography>
              <RHFTextField
                size="small"
                type="number"
                name={`items[${0}].price`}
                value={0.001}
                label="WETH amount"
                placeholder="0"
                onChange={(event) => {}}
                InputProps={{
                  startAdornment: <InputAdornment position="start">-</InputAdornment>,
                }}
                sx={{ width: '100%' }}
              />
            </Stack>
          </Stack>
          <Grid container spacing={2} sx={{pt:2}}>
            <Grid item xs={12} md={6}>
              <AppWidgetSummary
                title="Bullish pool"
                percent={2.6}
                total={1865}
                chart={{
                  colors: [theme.palette.primary.main],
                  series: [5, 18, 12, 51, 68, 11, 39, 37, 27, 20],
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <AppWidgetSummary
                title="Bearish pool"
                percent={-1.2}
                total={487}
                chart={{
                  colors: [theme.palette.error.main],
                  series: [20, 41, 63, 33, 28, 35, 50, 46, 11, 26],
                }}
              />
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} sx={{ pt: 2 }}>
            <Button
              fullWidth
              disabled={isMaxQuantity}
              size="large"
              color="success"
              variant="contained"
              onClick={handleAddCart}
              sx={{ whiteSpace: 'nowrap' }}
              endIcon="⇡"
            >
              Bullish
            </Button>

            <Button
              endIcon="⇣"
              fullWidth
              color="error"
              size="large"
              type="submit"
              variant="contained"
            >
              Bearish
            </Button>
          </Stack>
        </Stack>
      ),
    },
  ];
  const renderThumbnails = (
    <StyledThumbnailsContainer length={product.images.length} sx={{ pt: 3 }}>
      <Carousel {...carouselSettings2} asNavFor={nav1} ref={carousel2}>
        {product.images.map((img, index) => (
          <Image
            key={img}
            disabledEffect
            alt="thumbnail"
            src={img}
            onClick={() => handleOpenLightbox(img)}
            sx={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: 1.5,
              cursor: 'pointer',
              ...(currentIndex === index && {
                border: `solid 2px ${theme.palette.primary.main}`,
              }),
            }}
          />
        ))}
      </Carousel>
    </StyledThumbnailsContainer>
  );

  return (
    <FormProvider methods={methods} onSubmit={handleSubmit(onSubmit)}>
      <Stack
        spacing={3}
        sx={{
          p: (_theme) => ({
            md: _theme.spacing(0, 5, 0, 2),
          }),
        }}
        {...other}
      >
        <Stack spacing={0}>
          <Typography
            variant="overline"
            component="div"
            sx={{
              color: status === 'sale' ? 'error.main' : 'info.main',
            }}
          >
            {status}
          </Typography>

          <Typography variant="h5">
            {name}{' '}
            <Label
              variant="soft"
              color={inventoryType === 'In progress' ? 'success' : 'error'}
              sx={{ textTransform: 'uppercase', mr: 'auto' }}
            >
              {sentenceCase('In progress')}
            </Label>
          </Typography>
          {isDesktop ? (
            <Typography variant="subtitle2" sx={{ color: 'text.disabled', fontWeight: '300' }}>
              {Notpump_DEFINE_FAIRLAUNCH}
            </Typography>
          ) : (
            ''
          )}

          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {renderThumbnails}
            </Typography>
          </Stack>
        </Stack>
        <Box>
          <Tabs
            value={currentTabTrade}
            onChange={(event, value) => {
              setCurrentTabTrade(value);
            }}
            sx={{ px: 3, bgcolor: 'background.neutral', borderRadius: '10px' }}
          >
            {TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} label={tab.label} />
            ))}
          </Tabs>
        </Box>

        <Divider sx={{ borderStyle: 'dashed' }} />
        {TABS.map(
          (tab) =>
            tab.value === currentTabTrade && (
              <Box key={tab.value} sx={{ mt: 5 }}>
                {tab.component}
              </Box>
            )
        )}
        <Divider sx={{ borderStyle: 'dashed' }} />

        <Stack direction="row" alignItems="center" justifyContent="center">
          {_socials.map((social) => (
            <IconButton key={social.name}>
              <Iconify icon={social.icon} />
            </IconButton>
          ))}
        </Stack>
      </Stack>

      <Lightbox
        index={selectedImage}
        slides={imagesLightbox}
        open={selectedImage >= 0}
        close={handleCloseLightbox}
        onGetCurrentIndex={(index) => setCurrentIndex(index)}
      />
    </FormProvider>
  );
}

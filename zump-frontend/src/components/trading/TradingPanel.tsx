/**
 * TradingPanel Component
 * Buy/Sell interface for bonding curve trading
 * Requirements: 5.1, 5.4, 6.1
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import Iconify from '../iconify';
import { useTrading } from '../../hooks/useTrading';
import { formatBigIntWithDecimals, toBigIntWithDecimals } from '../../utils/bondingCurveUtils';

// ===========================================
// Types
// ===========================================

export interface TradingPanelProps {
  poolAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  quoteSymbol?: string;
  currentPrice?: bigint;
  isMigrated?: boolean;
  onTradeSuccess?: () => void;
}

type TradeTab = 'buy' | 'sell';

// ===========================================
// Constants
// ===========================================

const SLIPPAGE_OPTIONS = [0.5, 1, 2, 5];
const DEFAULT_SLIPPAGE = 1; // 1%
const DECIMALS = 18;

// ===========================================
// Component
// ===========================================

export default function TradingPanel({
  poolAddress,
  tokenAddress,
  tokenSymbol,
  quoteSymbol = 'ETH',
  currentPrice,
  isMigrated = false,
  onTradeSuccess,
}: TradingPanelProps) {
  const theme = useTheme();
  
  // State
  const [activeTab, setActiveTab] = useState<TradeTab>('buy');
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(DEFAULT_SLIPPAGE);
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [calculatedValue, setCalculatedValue] = useState<bigint | null>(null);
  const [isCalculatingValue, setIsCalculatingValue] = useState(false);

  // Trading hook
  const {
    getBuyCost,
    getSellReturn,
    buy,
    sell,
    isBuying,
    isSelling,
    error,
    clearError,
    userTokenBalance,
    userQuoteBalance,
    refreshBalances,
  } = useTrading({
    poolAddress,
    tokenAddress,
    onSuccess: () => {
      setAmount('');
      setCalculatedValue(null);
      onTradeSuccess?.();
    },
  });

  // Refresh balances on mount
  useEffect(() => {
    refreshBalances();
  }, [refreshBalances]);

  // Calculate cost/return when amount changes
  useEffect(() => {
    const calculateValue = async () => {
      if (!amount || parseFloat(amount) <= 0) {
        setCalculatedValue(null);
        return;
      }

      setIsCalculatingValue(true);
      try {
        const amountBigInt = toBigIntWithDecimals(amount, DECIMALS);
        
        if (activeTab === 'buy') {
          const cost = await getBuyCost(amountBigInt);
          setCalculatedValue(cost);
        } else {
          const returnValue = await getSellReturn(amountBigInt);
          setCalculatedValue(returnValue);
        }
      } catch (err) {
        console.error('Failed to calculate value:', err);
        setCalculatedValue(null);
      } finally {
        setIsCalculatingValue(false);
      }
    };

    // Debounce calculation
    const timeoutId = setTimeout(calculateValue, 300);
    return () => clearTimeout(timeoutId);
  }, [amount, activeTab, getBuyCost, getSellReturn]);

  // Handle tab change
  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: TradeTab) => {
    setActiveTab(newValue);
    setAmount('');
    setCalculatedValue(null);
    clearError();
  }, [clearError]);

  // Handle amount change
  const handleAmountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // Only allow valid number input
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      clearError();
    }
  }, [clearError]);

  // Handle max button click
  const handleMaxClick = useCallback(() => {
    if (activeTab === 'buy' && userQuoteBalance) {
      // For buy, we can't easily calculate max tokens from quote balance
      // So we just show the quote balance
      setAmount(formatBigIntWithDecimals(userQuoteBalance, DECIMALS, 6));
    } else if (activeTab === 'sell' && userTokenBalance) {
      setAmount(formatBigIntWithDecimals(userTokenBalance, DECIMALS, 6));
    }
  }, [activeTab, userQuoteBalance, userTokenBalance]);

  // Handle trade execution
  const handleTrade = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    const amountBigInt = toBigIntWithDecimals(amount, DECIMALS);
    
    // Calculate slippage tolerance
    const slippageMultiplier = BigInt(Math.floor((100 + slippage) * 100));
    const slippageDivisor = BigInt(10000);

    try {
      if (activeTab === 'buy') {
        // For buy, maxCost = calculatedCost * (1 + slippage)
        const maxCost = calculatedValue 
          ? (calculatedValue * slippageMultiplier) / slippageDivisor
          : undefined;
        await buy(amountBigInt, maxCost);
      } else {
        // For sell, minReturn = calculatedReturn * (1 - slippage)
        const minSlippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
        const minReturn = calculatedValue
          ? (calculatedValue * minSlippageMultiplier) / slippageDivisor
          : undefined;
        await sell(amountBigInt, minReturn);
      }
    } catch (err) {
      // Error is handled by the hook
      console.error('Trade failed:', err);
    }
  }, [amount, activeTab, slippage, calculatedValue, buy, sell]);

  // Check if trade is disabled
  const isTradeDisabled = useMemo(() => {
    if (isMigrated) return true;
    if (!amount || parseFloat(amount) <= 0) return true;
    if (isBuying || isSelling) return true;
    if (isCalculatingValue) return true;
    
    if (activeTab === 'sell' && userTokenBalance !== null) {
      const amountBigInt = toBigIntWithDecimals(amount, DECIMALS);
      if (amountBigInt > userTokenBalance) return true;
    }
    
    return false;
  }, [isMigrated, amount, isBuying, isSelling, isCalculatingValue, activeTab, userTokenBalance]);

  // Get button text
  const buttonText = useMemo(() => {
    if (isBuying) return 'Buying...';
    if (isSelling) return 'Selling...';
    if (isMigrated) return 'Pool Migrated';
    if (activeTab === 'buy') return 'Buy';
    return 'Sell';
  }, [isBuying, isSelling, isMigrated, activeTab]);

  return (
    <Card sx={{ p: 3 }}>
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            minWidth: 0,
            flex: 1,
          },
        }}
      >
        <Tab 
          value="buy" 
          label="Buy" 
          sx={{ 
            color: activeTab === 'buy' ? 'success.main' : 'text.secondary',
          }}
        />
        <Tab 
          value="sell" 
          label="Sell"
          sx={{ 
            color: activeTab === 'sell' ? 'error.main' : 'text.secondary',
          }}
        />
      </Tabs>

      {/* Migrated Warning */}
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

      {/* Error Display */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={clearError}
        >
          {error.message}
        </Alert>
      )}

      <Box>
        {/* Amount Input */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {activeTab === 'buy' ? `${tokenSymbol} Amount` : `${tokenSymbol} Amount`}
            </Typography>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ cursor: 'pointer' }}
              onClick={handleMaxClick}
            >
              Balance: {activeTab === 'buy' 
                ? (userQuoteBalance ? formatBigIntWithDecimals(userQuoteBalance, DECIMALS, 4) : '0')
                : (userTokenBalance ? formatBigIntWithDecimals(userTokenBalance, DECIMALS, 4) : '0')
              } {activeTab === 'buy' ? quoteSymbol : tokenSymbol}
            </Typography>
          </Stack>
          
          <TextField
            fullWidth
            type="text"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.0"
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
          />
        </Box>

        {/* Swap Icon */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <IconButton 
            sx={{ 
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.16),
              },
            }}
          >
            <Iconify icon="eva:swap-outline" />
          </IconButton>
        </Box>

        {/* Calculated Value Display */}
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {activeTab === 'buy' ? `Cost (${quoteSymbol})` : `Return (${quoteSymbol})`}
            </Typography>
          </Stack>
          
          <TextField
            fullWidth
            type="text"
            value={calculatedValue ? formatBigIntWithDecimals(calculatedValue, DECIMALS, 6) : ''}
            placeholder="0.0"
            disabled
            InputProps={{
              readOnly: true,
              endAdornment: isCalculatingValue ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : null,
            }}
          />
        </Box>

        {/* Slippage Settings */}
        <Box sx={{ mb: 2 }}>
          <Stack 
            direction="row" 
            alignItems="center" 
            justifyContent="space-between"
            sx={{ cursor: 'pointer' }}
            onClick={() => setShowSlippageSettings(!showSlippageSettings)}
          >
            <Typography variant="body2" color="text.secondary">
              Slippage Tolerance
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Typography variant="body2" fontWeight="bold">
                {slippage}%
              </Typography>
              <Iconify 
                icon={showSlippageSettings ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'} 
                width={20}
              />
            </Stack>
          </Stack>

          {showSlippageSettings && (
            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                {SLIPPAGE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    size="small"
                    variant={slippage === option ? 'contained' : 'outlined'}
                    onClick={() => setSlippage(option)}
                    sx={{ minWidth: 50 }}
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
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}%`}
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Trade Summary */}
        {amount && parseFloat(amount) > 0 && calculatedValue !== null && (
          <Box sx={{ p: 2, bgcolor: 'background.neutral', borderRadius: 1, mb: 2 }}>
            <Box>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {activeTab === 'buy' ? 'You Pay' : 'You Sell'}
                </Typography>
                <Typography variant="body2">
                  {activeTab === 'buy' 
                    ? `${formatBigIntWithDecimals(calculatedValue, DECIMALS, 6)} ${quoteSymbol}`
                    : `${amount} ${tokenSymbol}`
                  }
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {activeTab === 'buy' ? 'You Receive' : 'You Receive'}
                </Typography>
                <Typography variant="body2">
                  {activeTab === 'buy'
                    ? `${amount} ${tokenSymbol}`
                    : `${formatBigIntWithDecimals(calculatedValue, DECIMALS, 6)} ${quoteSymbol}`
                  }
                </Typography>
              </Stack>
              {currentPrice !== undefined && currentPrice !== null && (
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Price
                  </Typography>
                  <Typography variant="body2">
                    {formatBigIntWithDecimals(currentPrice, DECIMALS, 8)} {quoteSymbol}
                  </Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Max Slippage
                </Typography>
                <Typography variant="body2">
                  {slippage}%
                </Typography>
              </Stack>
            </Box>
          </Box>
        )}

        {/* Trade Button */}
        <Button
          fullWidth
          size="large"
          variant="contained"
          color={activeTab === 'buy' ? 'success' : 'error'}
          onClick={handleTrade}
          disabled={isTradeDisabled}
          startIcon={(isBuying || isSelling) && <CircularProgress size={20} color="inherit" />}
        >
          {buttonText}
        </Button>
      </Box>
    </Card>
  );
}

export { TradingPanel };

/**
 * PriceDisplay Component
 * Shows current price with change indicator and animations
 * Requirements: 10.2, 10.5
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Tooltip, Skeleton, Alert, IconButton } from '@mui/material';
import { styled, keyframes, alpha } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { usePricePolling, PriceData, PriceChangeDirection } from '../../hooks/usePricePolling';
import { formatBigIntWithDecimals } from '../../utils/bondingCurveUtils';

// ===========================================
// Types
// ===========================================

export interface PriceDisplayProps {
  poolAddress: string;
  pollingInterval?: number;
  showChangeIndicator?: boolean;
  showPercentage?: boolean;
  showStaleWarning?: boolean;
  size?: 'small' | 'medium' | 'large';
  decimals?: number;
  displayDecimals?: number;
  quoteSymbol?: string;
  onPriceChange?: (priceData: PriceData) => void;
}

// ===========================================
// Animations
// ===========================================

const pulseUp = keyframes`
  0% {
    background-color: transparent;
  }
  50% {
    background-color: rgba(76, 175, 80, 0.3);
  }
  100% {
    background-color: transparent;
  }
`;

const pulseDown = keyframes`
  0% {
    background-color: transparent;
  }
  50% {
    background-color: rgba(244, 67, 54, 0.3);
  }
  100% {
    background-color: transparent;
  }
`;

// ===========================================
// Styled Components
// ===========================================

interface PriceContainerProps {
  changeDirection: PriceChangeDirection;
  animate: boolean;
}

const PriceContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'changeDirection' && prop !== 'animate',
})<PriceContainerProps>(({ theme, changeDirection, animate }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  transition: 'background-color 0.3s ease',
  ...(animate && changeDirection === 'up' && {
    animation: `${pulseUp} 1s ease-out`,
  }),
  ...(animate && changeDirection === 'down' && {
    animation: `${pulseDown} 1s ease-out`,
  }),
}));

const ChangeIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'direction',
})<{ direction: PriceChangeDirection }>(({ theme, direction }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.25, 0.5),
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.75rem',
  fontWeight: 600,
  ...(direction === 'up' && {
    color: theme.palette.success.main,
    backgroundColor: alpha(theme.palette.success.main, 0.1),
  }),
  ...(direction === 'down' && {
    color: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.1),
  }),
  ...(direction === 'unchanged' && {
    color: theme.palette.text.secondary,
    backgroundColor: alpha(theme.palette.grey[500], 0.1),
  }),
}));

const StaleWarning = styled(Alert)(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
  fontSize: '0.75rem',
  '& .MuiAlert-icon': {
    fontSize: '1rem',
    padding: 0,
    marginRight: theme.spacing(0.5),
  },
  '& .MuiAlert-message': {
    padding: 0,
  },
}));

// ===========================================
// Helper Functions
// ===========================================

const getSizeStyles = (size: 'small' | 'medium' | 'large') => {
  switch (size) {
    case 'small':
      return { fontSize: '0.875rem', iconSize: 16 };
    case 'large':
      return { fontSize: '1.5rem', iconSize: 28 };
    default:
      return { fontSize: '1.125rem', iconSize: 20 };
  }
};

const getChangeIcon = (direction: PriceChangeDirection, size: number) => {
  switch (direction) {
    case 'up':
      return <TrendingUpIcon sx={{ fontSize: size }} />;
    case 'down':
      return <TrendingDownIcon sx={{ fontSize: size }} />;
    default:
      return <TrendingFlatIcon sx={{ fontSize: size }} />;
  }
};

// ===========================================
// Component
// ===========================================

/**
 * PriceDisplay Component
 * 
 * Requirements:
 * - 10.2: Show current price with change indicator, animate price updates
 * - 10.5: Show stale data warning on connection loss
 */
export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  poolAddress,
  pollingInterval = 10000,
  showChangeIndicator = true,
  showPercentage = true,
  showStaleWarning = true,
  size = 'medium',
  decimals = 18,
  displayDecimals = 4,
  quoteSymbol = 'STRK',
  onPriceChange,
}) => {
  const [animate, setAnimate] = useState(false);
  const prevPriceRef = useRef<bigint | null>(null);
  
  const {
    priceData,
    isLoading,
    isStale,
    error,
    connectionStatus,
    refresh,
  } = usePricePolling({
    poolAddress,
    pollingInterval,
    enabled: true,
  });

  const sizeStyles = getSizeStyles(size);

  // Trigger animation on price change
  // Requirements: 10.2 - Animate price updates
  useEffect(() => {
    if (priceData && prevPriceRef.current !== null) {
      if (priceData.currentPrice !== prevPriceRef.current) {
        setAnimate(true);
        const timer = setTimeout(() => setAnimate(false), 1000);
        return () => clearTimeout(timer);
      }
    }
    prevPriceRef.current = priceData?.currentPrice ?? null;
  }, [priceData?.currentPrice]);

  // Notify parent of price changes
  useEffect(() => {
    if (priceData && onPriceChange) {
      onPriceChange(priceData);
    }
  }, [priceData, onPriceChange]);

  // Loading state
  if (isLoading && !priceData) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Skeleton variant="text" width={100} height={sizeStyles.fontSize === '1.5rem' ? 36 : 24} />
        {showChangeIndicator && (
          <Skeleton variant="rounded" width={60} height={24} />
        )}
      </Box>
    );
  }

  // Error state with no data
  if (error && !priceData) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography color="error" sx={{ fontSize: sizeStyles.fontSize }}>
          --
        </Typography>
        <Tooltip title={error.message}>
          <IconButton size="small" onClick={refresh} color="error">
            <RefreshIcon sx={{ fontSize: sizeStyles.iconSize }} />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  if (!priceData) {
    return null;
  }

  const formattedPrice = formatBigIntWithDecimals(
    priceData.currentPrice,
    decimals,
    displayDecimals
  );

  const formattedChange = priceData.changeAmount > BigInt(0)
    ? formatBigIntWithDecimals(priceData.changeAmount, decimals, displayDecimals)
    : '0';

  return (
    <Box>
      <PriceContainer
        changeDirection={priceData.changeDirection}
        animate={animate}
      >
        {/* Price Value */}
        <Typography
          sx={{
            fontSize: sizeStyles.fontSize,
            fontWeight: 600,
            color: priceData.changeDirection === 'up'
              ? 'success.main'
              : priceData.changeDirection === 'down'
              ? 'error.main'
              : 'text.primary',
          }}
        >
          {formattedPrice} {quoteSymbol}
        </Typography>

        {/* Change Indicator */}
        {/* Requirements: 10.2 - Show change indicator (green up, red down) */}
        {showChangeIndicator && priceData.previousPrice !== null && (
          <ChangeIndicator direction={priceData.changeDirection}>
            {getChangeIcon(priceData.changeDirection, sizeStyles.iconSize * 0.8)}
            {showPercentage && (
              <span>
                {priceData.changeDirection === 'down' ? '-' : '+'}
                {Math.abs(priceData.changePercentage).toFixed(2)}%
              </span>
            )}
          </ChangeIndicator>
        )}

        {/* Refresh Button */}
        {connectionStatus === 'disconnected' && (
          <Tooltip title="Bağlantı kesildi. Yenilemek için tıklayın.">
            <IconButton size="small" onClick={refresh} color="warning">
              <RefreshIcon sx={{ fontSize: sizeStyles.iconSize }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Reconnecting Indicator */}
        {connectionStatus === 'reconnecting' && (
          <Tooltip title="Yeniden bağlanılıyor...">
            <RefreshIcon
              sx={{
                fontSize: sizeStyles.iconSize,
                color: 'warning.main',
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
          </Tooltip>
        )}
      </PriceContainer>

      {/* Stale Data Warning */}
      {/* Requirements: 10.5 - Show stale data warning on connection loss */}
      {showStaleWarning && isStale && (
        <StaleWarning severity="warning" icon={<WarningAmberIcon />}>
          Fiyat verileri güncel olmayabilir. Son güncelleme:{' '}
          {priceData.lastUpdated.toLocaleTimeString()}
        </StaleWarning>
      )}
    </Box>
  );
};

export default PriceDisplay;

/**
 * PortfolioPanel Component
 * Displays user token holdings with balance and value
 * Requirements: 9.2, 9.5
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardHeader,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  Alert,
  Avatar,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import Iconify from '../iconify';
import { usePortfolio, TokenHolding } from '../../hooks/usePortfolio';
import { formatBigIntWithDecimals } from '../../utils/bondingCurveUtils';
import { PATH_DASHBOARD } from '../../routes/paths';

// ===========================================
// Types
// ===========================================

export interface PortfolioPanelProps {
  /** Polling interval in milliseconds (0 to disable) */
  pollingInterval?: number;
  /** Maximum number of holdings to display */
  maxItems?: number;
  /** Show header with title */
  showHeader?: boolean;
  /** Custom title */
  title?: string;
  /** Quote token symbol */
  quoteSymbol?: string;
}

// ===========================================
// Constants
// ===========================================

const DECIMALS = 18;
const DEFAULT_MAX_ITEMS = 10;

// ===========================================
// Sub-components
// ===========================================

interface HoldingItemProps {
  holding: TokenHolding;
  quoteSymbol: string;
  onClick: () => void;
}

function HoldingItem({ holding, quoteSymbol, onClick }: HoldingItemProps) {
  const theme = useTheme();

  return (
    <ListItem
      sx={{
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.08),
        },
        borderRadius: 1,
      }}
      onClick={onClick}
    >
      <ListItemAvatar>
        <Avatar
          src={holding.imageUrl || undefined}
          alt={holding.name}
          sx={{
            width: 40,
            height: 40,
            bgcolor: alpha(theme.palette.primary.main, 0.16),
          }}
        >
          {holding.symbol.charAt(0).toUpperCase()}
        </Avatar>
      </ListItemAvatar>

      <ListItemText
        primary={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" noWrap>
              {holding.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {holding.symbol}
            </Typography>
            {holding.migrated && (
              <Tooltip title="DEX'e taşınmış">
                <Iconify
                  icon="eva:external-link-fill"
                  width={14}
                  sx={{ color: 'warning.main' }}
                />
              </Tooltip>
            )}
          </Stack>
        }
        secondary={
          <Typography variant="caption" color="text.secondary">
            {formatBigIntWithDecimals(holding.balance, DECIMALS, 4)} {holding.symbol}
          </Typography>
        }
      />

      <Stack alignItems="flex-end">
        <Typography variant="subtitle2">
          {formatBigIntWithDecimals(holding.value, DECIMALS * 2, 4)} {quoteSymbol}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          @ {formatBigIntWithDecimals(holding.currentPrice, DECIMALS, 6)} {quoteSymbol}
        </Typography>
      </Stack>
    </ListItem>
  );
}

function HoldingItemSkeleton() {
  return (
    <ListItem sx={{ px: 2, py: 1.5 }}>
      <ListItemAvatar>
        <Skeleton variant="circular" width={40} height={40} />
      </ListItemAvatar>
      <ListItemText
        primary={<Skeleton width={120} />}
        secondary={<Skeleton width={80} />}
      />
      <Stack alignItems="flex-end">
        <Skeleton width={60} />
        <Skeleton width={40} />
      </Stack>
    </ListItem>
  );
}

interface EmptyStateProps {
  onNavigate: () => void;
}

function EmptyState({ onNavigate }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: 6,
        px: 3,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          mx: 'auto',
          mb: 2,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Iconify
          icon="eva:briefcase-outline"
          width={40}
          sx={{ color: 'primary.main' }}
        />
      </Box>

      <Typography variant="h6" gutterBottom>
        Henüz token yok
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Portföyünüzde henüz token bulunmuyor. Fairlaunch sayfasından token satın alabilirsiniz.
      </Typography>

      <Button
        variant="contained"
        startIcon={<Iconify icon="eva:shopping-bag-fill" />}
        onClick={onNavigate}
      >
        Fairlaunch&apos;a Git
      </Button>
    </Box>
  );
}

// ===========================================
// Main Component
// ===========================================

export default function PortfolioPanel({
  pollingInterval = 30000, // 30 seconds default
  maxItems = DEFAULT_MAX_ITEMS,
  showHeader = true,
  title = 'Portföyüm',
  quoteSymbol = 'ETH',
}: PortfolioPanelProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const {
    holdings,
    totalValue,
    isLoading,
    error,
    refetch,
    isEmpty,
  } = usePortfolio({
    autoFetch: true,
    pollingInterval,
  });

  // Navigate to token detail page
  const handleHoldingClick = useCallback(
    (tokenAddress: string) => {
      navigate(PATH_DASHBOARD.dn404.view(tokenAddress));
    },
    [navigate]
  );

  // Navigate to fairlaunch page
  const handleNavigateToFairlaunch = useCallback(() => {
    navigate(PATH_DASHBOARD.dn404.bondingCurve);
  }, [navigate]);

  // Limit displayed holdings
  const displayedHoldings = holdings.slice(0, maxItems);
  const hasMore = holdings.length > maxItems;

  return (
    <Card>
      {showHeader && (
        <>
          <CardHeader
            title={title}
            action={
              <Tooltip title="Yenile">
                <IconButton onClick={refetch} disabled={isLoading}>
                  {isLoading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Iconify icon="eva:refresh-fill" />
                  )}
                </IconButton>
              </Tooltip>
            }
          />
          <Divider />
        </>
      )}

      {/* Error State */}
      {error && (
        <Alert
          severity="error"
          sx={{ m: 2 }}
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              Tekrar Dene
            </Button>
          }
        >
          Portföy yüklenirken hata oluştu
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && isEmpty && (
        <List disablePadding>
          {[1, 2, 3].map((i) => (
            <HoldingItemSkeleton key={i} />
          ))}
        </List>
      )}

      {/* Empty State */}
      {!isLoading && isEmpty && !error && (
        <EmptyState onNavigate={handleNavigateToFairlaunch} />
      )}

      {/* Holdings List */}
      {!isEmpty && (
        <>
          {/* Total Value */}
          <Box
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Toplam Değer
              </Typography>
              <Typography variant="h5">
                {formatBigIntWithDecimals(totalValue, DECIMALS * 2, 4)} {quoteSymbol}
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Holdings */}
          <List disablePadding>
            {displayedHoldings.map((holding, index) => (
              <Box key={holding.tokenAddress}>
                <HoldingItem
                  holding={holding}
                  quoteSymbol={quoteSymbol}
                  onClick={() => handleHoldingClick(holding.tokenAddress)}
                />
                {index < displayedHoldings.length - 1 && (
                  <Divider variant="inset" component="li" />
                )}
              </Box>
            ))}
          </List>

          {/* Show More */}
          {hasMore && (
            <>
              <Divider />
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Button
                  size="small"
                  onClick={handleNavigateToFairlaunch}
                  endIcon={<Iconify icon="eva:arrow-forward-fill" />}
                >
                  Tümünü Gör ({holdings.length} token)
                </Button>
              </Box>
            </>
          )}
        </>
      )}
    </Card>
  );
}

export { PortfolioPanel };

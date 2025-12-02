/**
 * BalanceAggregation Component
 * Displays aggregated balances across all stealth addresses
 * Requirements: 10.4
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Chip,
  Collapse,
  Divider,
  Stack,
  Avatar,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useBalanceAggregation, SUPPORTED_TOKENS } from '../../hooks/useBalanceAggregation';
import { useStealthAddress } from '../../hooks/useStealthAddress';
import { useWallet } from '../../hooks/useWallet';
import { AggregatedBalance } from '../../@types/privacy';

interface BalanceAggregationProps {
  compact?: boolean;
}

// Token icons (simplified - would use actual token logos in production)
const TOKEN_COLORS: Record<string, string> = {
  ETH: '#627EEA',
  STRK: '#FF6B35',
  USDC: '#2775CA',
  USDT: '#26A17B',
};

export function BalanceAggregation({ compact = false }: BalanceAggregationProps) {
  const { isConnected } = useWallet();
  const { stealthAddresses } = useStealthAddress();
  const {
    aggregatedBalances,
    totalValueUsd,
    isLoading,
    error,
    refreshBalances,
  } = useBalanceAggregation();

  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  const handleToggleExpand = (token: string) => {
    setExpandedToken(expandedToken === token ? null : token);
  };

  const formatAddress = (address: string) => {
    if (address.length <= 13) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <Card sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography color="text.secondary" align="center">
            Bakiyeleri görmek için cüzdanınızı bağlayın
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ bgcolor: 'background.paper', borderRadius: 2 }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWalletIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6">Toplam Bakiye</Typography>
          </Box>
        }
        action={
          <Tooltip title="Yenile">
            <IconButton onClick={refreshBalances} disabled={isLoading}>
              {isLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        }
        sx={{ pb: 0 }}
      />
      
      <CardContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Total Value Display */}
        <Box
          sx={{
            bgcolor: 'primary.main',
            borderRadius: 2,
            p: 2,
            mb: 2,
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" sx={{ opacity: 0.8, color: 'white' }}>
            Tahmini Toplam Değer
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'white' }}>
            ${totalValueUsd}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7, color: 'white' }}>
            {stealthAddresses.length} stealth adres üzerinden
          </Typography>
        </Box>

        {stealthAddresses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <AccountBalanceWalletIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              Önce bir stealth adres oluşturun
            </Typography>
          </Box>
        ) : aggregatedBalances.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography color="text.secondary">
              Stealth adreslerinizde bakiye bulunamadı
            </Typography>
          </Box>
        ) : (
          <List>
            {aggregatedBalances.map((balance, index) => (
              <React.Fragment key={balance.token}>
                <AggregatedBalanceItem
                  balance={balance}
                  isExpanded={expandedToken === balance.token}
                  onToggleExpand={() => handleToggleExpand(balance.token)}
                  formatAddress={formatAddress}
                  compact={compact}
                />
                {index < aggregatedBalances.length - 1 && <Divider sx={{ my: 1 }} />}
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Supported Tokens Info */}
        {!compact && (
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Desteklenen Tokenlar:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {SUPPORTED_TOKENS.map(token => (
                <Chip
                  key={token.symbol}
                  label={token.symbol}
                  size="small"
                  avatar={
                    <Avatar sx={{ bgcolor: TOKEN_COLORS[token.symbol], width: 20, height: 20 }}>
                      <Typography variant="caption" sx={{ fontSize: 10, color: 'white' }}>
                        {token.symbol[0]}
                      </Typography>
                    </Avatar>
                  }
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

interface AggregatedBalanceItemProps {
  balance: AggregatedBalance;
  isExpanded: boolean;
  onToggleExpand: () => void;
  formatAddress: (address: string) => string;
  compact?: boolean;
}

function AggregatedBalanceItem({
  balance,
  isExpanded,
  onToggleExpand,
  formatAddress,
  compact,
}: AggregatedBalanceItemProps) {
  const tokenColor = TOKEN_COLORS[balance.tokenSymbol] || '#888';

  return (
    <>
      <ListItem
        sx={{
          bgcolor: 'action.hover',
          borderRadius: 1,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.selected',
          },
        }}
        onClick={onToggleExpand}
      >
        <ListItemIcon sx={{ minWidth: 48 }}>
          <Avatar sx={{ bgcolor: tokenColor, width: 36, height: 36 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
              {balance.tokenSymbol[0]}
            </Typography>
          </Avatar>
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body1" fontWeight={600}>
                {balance.tokenSymbol}
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {balance.formattedBalance}
              </Typography>
            </Box>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {balance.stealthBalances.length} stealth adres
            </Typography>
          }
        />
        {!compact && (
          <IconButton size="small">
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </ListItem>

      {/* Expanded Details */}
      {!compact && (
        <Collapse in={isExpanded}>
          <Box sx={{ pl: 7, pr: 2, py: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Adres Bazında Dağılım:
            </Typography>
            {balance.stealthBalances.map((sb, idx) => (
              <Box
                key={`${sb.address}-${idx}`}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 0.5,
                  px: 1,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  mb: 0.5,
                }}
              >
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {formatAddress(sb.address)}
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {sb.formattedBalance} {sb.tokenSymbol}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
    </>
  );
}

export default BalanceAggregation;

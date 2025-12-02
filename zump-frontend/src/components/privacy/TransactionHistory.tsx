/**
 * TransactionHistory Component
 * Displays transaction history filtered by user's view tags
 * Requirements: 10.2
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Divider,
  Link,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SellIcon from '@mui/icons-material/Sell';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTransactionHistory } from '../../hooks/useTransactionHistory';
import { useStealthAddress } from '../../hooks/useStealthAddress';
import { useWallet } from '../../hooks/useWallet';
import { PrivateTransaction } from '../../@types/privacy';

interface TransactionHistoryProps {
  maxItems?: number;
  compact?: boolean;
}

export function TransactionHistory({ maxItems, compact = false }: TransactionHistoryProps) {
  const { isConnected } = useWallet();
  const { stealthAddresses } = useStealthAddress();
  const {
    filteredTransactions,
    isLoading,
    error,
    refreshTransactions,
    filterByViewTag,
    filterByType,
    activeViewTagFilter,
    activeTypeFilter,
  } = useTransactionHistory();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const displayTransactions = maxItems
    ? filteredTransactions.slice(0, maxItems)
    : filteredTransactions;

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getTransactionIcon = (type: PrivateTransaction['type']) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownwardIcon color="success" />;
      case 'withdraw':
        return <ArrowUpwardIcon color="error" />;
      case 'buy':
        return <ShoppingCartIcon color="primary" />;
      case 'sell':
        return <SellIcon color="warning" />;
      case 'transfer':
        return <SwapHorizIcon color="info" />;
      default:
        return <SwapHorizIcon />;
    }
  };

  const getTransactionLabel = (type: PrivateTransaction['type']) => {
    const labels: Record<PrivateTransaction['type'], string> = {
      deposit: 'Yatırma',
      withdraw: 'Çekme',
      buy: 'Alım',
      sell: 'Satım',
      transfer: 'Transfer',
    };
    return labels[type];
  };

  const getStatusColor = (status: PrivateTransaction['status']) => {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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
            İşlem geçmişini görmek için cüzdanınızı bağlayın
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
            <HistoryIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6">İşlem Geçmişi</Typography>
            <Chip
              label={filteredTransactions.length}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          </Box>
        }
        action={
          <Tooltip title="Yenile">
            <IconButton onClick={refreshTransactions} disabled={isLoading}>
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

        {/* Filters */}
        {!compact && (
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Stealth Adres</InputLabel>
              <Select
                value={activeViewTagFilter || ''}
                label="Stealth Adres"
                onChange={(e) => filterByViewTag(e.target.value || null)}
              >
                <MenuItem value="">Tümü</MenuItem>
                {stealthAddresses.map((sa, index) => (
                  <MenuItem key={sa.viewTag} value={sa.viewTag}>
                    #{index + 1} - {formatAddress(sa.viewTag)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>İşlem Tipi</InputLabel>
              <Select
                value={activeTypeFilter || ''}
                label="İşlem Tipi"
                onChange={(e) => filterByType((e.target.value as PrivateTransaction['type']) || null)}
              >
                <MenuItem value="">Tümü</MenuItem>
                <MenuItem value="deposit">Yatırma</MenuItem>
                <MenuItem value="withdraw">Çekme</MenuItem>
                <MenuItem value="buy">Alım</MenuItem>
                <MenuItem value="sell">Satım</MenuItem>
                <MenuItem value="transfer">Transfer</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}

        {displayTransactions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              {stealthAddresses.length === 0
                ? 'Önce bir stealth adres oluşturun'
                : 'Henüz işlem geçmişi yok'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: compact ? 200 : 400, overflow: 'auto' }}>
            {displayTransactions.map((tx, index) => (
              <React.Fragment key={tx.id}>
                <TransactionItem
                  transaction={tx}
                  onCopy={handleCopy}
                  copiedId={copiedId}
                  getTransactionIcon={getTransactionIcon}
                  getTransactionLabel={getTransactionLabel}
                  getStatusColor={getStatusColor}
                  formatTimestamp={formatTimestamp}
                  formatAddress={formatAddress}
                  compact={compact}
                />
                {index < displayTransactions.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

interface TransactionItemProps {
  transaction: PrivateTransaction;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
  getTransactionIcon: (type: PrivateTransaction['type']) => React.ReactNode;
  getTransactionLabel: (type: PrivateTransaction['type']) => string;
  getStatusColor: (status: PrivateTransaction['status']) => 'success' | 'warning' | 'error' | 'default';
  formatTimestamp: (timestamp: number) => string;
  formatAddress: (address: string) => string;
  compact?: boolean;
}

function TransactionItem({
  transaction,
  onCopy,
  copiedId,
  getTransactionIcon,
  getTransactionLabel,
  getStatusColor,
  formatTimestamp,
  formatAddress,
  compact,
}: TransactionItemProps) {
  return (
    <ListItem
      sx={{
        bgcolor: 'action.hover',
        borderRadius: 1,
        mb: 0.5,
        '&:hover': {
          bgcolor: 'action.selected',
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        {getTransactionIcon(transaction.type)}
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={600}>
              {getTransactionLabel(transaction.type)}
            </Typography>
            <Typography variant="body2" color="primary.main">
              {transaction.amount} {transaction.tokenSymbol}
            </Typography>
            <Chip
              label={transaction.status === 'confirmed' ? 'Onaylandı' : transaction.status === 'pending' ? 'Bekliyor' : 'Başarısız'}
              size="small"
              color={getStatusColor(transaction.status)}
              sx={{ height: 20 }}
            />
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.5 }}>
            {!compact && (
              <Typography variant="caption" color="text.secondary" display="block">
                View Tag: {formatAddress(transaction.viewTag)}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(transaction.timestamp)}
            </Typography>
          </Box>
        }
      />
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {transaction.txHash && (
          <>
            <Tooltip title={copiedId === transaction.id ? 'Kopyalandı!' : 'TX Hash Kopyala'}>
              <IconButton
                size="small"
                onClick={() => onCopy(transaction.txHash!, transaction.id)}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Explorer'da Görüntüle">
              <IconButton
                size="small"
                component={Link}
                href={`https://starkscan.co/tx/${transaction.txHash}`}
                target="_blank"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </ListItem>
  );
}

export default TransactionHistory;

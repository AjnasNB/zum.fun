/**
 * TradeTableRow Component
 * Displays a single trade event row in the trade history table
 * Requirements: 7.3
 */

import { Link, Stack, TableRow, TableCell, Typography } from '@mui/material';
import { useTheme } from '@mui/system';
import { fDate, fDateTime } from '../../../../utils/formatTime';
import { formatAddress } from '../../../../utils/formatAddress';
import Label from '../../../../components/label';
import { ParsedTradeEvent } from '../../../../hooks/useTradeHistory';

// ===========================================
// Types
// ===========================================

type Props = {
  row: ParsedTradeEvent;
  selected?: boolean;
  onSelectRow?: VoidFunction;
};

// ===========================================
// Helper Functions
// ===========================================

/**
 * Format bigint to human-readable token amount
 */
function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4);
  return `${whole}.${fractionStr}`;
}

/**
 * Format bigint price to human-readable format
 */
function formatPrice(price: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const whole = price / divisor;
  const fraction = price % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 6);
  return `${whole}.${fractionStr}`;
}

/**
 * Get explorer URL for transaction
 */
function getExplorerTxUrl(txHash: string): string {
  // Starknet Sepolia explorer
  return `https://sepolia.starkscan.co/tx/${txHash}`;
}

/**
 * Get explorer URL for address
 */
function getExplorerAddressUrl(address: string): string {
  return `https://sepolia.starkscan.co/contract/${address}`;
}

// ===========================================
// Component
// ===========================================

export default function TradeTableRow({ row, selected, onSelectRow }: Props) {
  const theme = useTheme();
  
  const {
    type,
    trader,
    amountTokens,
    costOrReturn,
    price,
    timestamp,
    txHash,
  } = row;

  const isBuy = type === 'buy';

  return (
    <TableRow hover selected={selected}>
      {/* Timestamp */}
      <TableCell align="left">
        <Stack>
          <Typography variant="body2" noWrap>
            {fDate(timestamp)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {fDateTime(timestamp).split(' ').slice(1).join(' ')}
          </Typography>
        </Stack>
      </TableCell>

      {/* Trader Address */}
      <TableCell>
        <Link
          href={getExplorerAddressUrl(trader)}
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
          sx={{ color: 'text.disabled', cursor: 'pointer' }}
        >
          {formatAddress(trader)}
        </Link>
      </TableCell>

      {/* Trade Type */}
      <TableCell align="left">
        <Label
          variant="soft"
          color={isBuy ? 'success' : 'error'}
        >
          {type.toUpperCase()}
        </Label>
      </TableCell>

      {/* Amount */}
      <TableCell align="center">
        <Typography variant="body2">
          {formatTokenAmount(amountTokens)}
        </Typography>
      </TableCell>

      {/* Price */}
      <TableCell align="left">
        <Typography variant="body2">
          {formatPrice(price)}
        </Typography>
      </TableCell>

      {/* Cost/Return */}
      <TableCell align="left">
        <Typography
          variant="body2"
          sx={{ color: isBuy ? theme.palette.error.main : theme.palette.success.main }}
        >
          {isBuy ? '-' : '+'}{formatPrice(costOrReturn)}
        </Typography>
      </TableCell>

      {/* Transaction Hash */}
      <TableCell align="center">
        <Link
          href={getExplorerTxUrl(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          variant="body2"
          sx={{ color: 'text.disabled', cursor: 'pointer' }}
        >
          {formatAddress(txHash)}
        </Link>
      </TableCell>
    </TableRow>
  );
}

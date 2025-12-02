/**
 * ErrorDisplay Component
 * Displays user-friendly error messages with recovery options
 * Requirements: 10.5
 */

import React from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Stack,
  Typography,
  Collapse,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { PrivacyError, RecoveryOption } from '../../@types/privacy';

interface ErrorDisplayProps {
  error: PrivacyError | null;
  onClose?: () => void;
  onRecoveryAction?: (action: string) => void;
  compact?: boolean;
}

// Icon mapping for recovery actions
const ACTION_ICONS: Record<string, React.ReactNode> = {
  retry: <RefreshIcon fontSize="small" />,
  reconnect: <AccountBalanceWalletIcon fontSize="small" />,
  check_wallet: <AccountBalanceWalletIcon fontSize="small" />,
  regenerate_proof: <RefreshIcon fontSize="small" />,
  swap: <SwapHorizIcon fontSize="small" />,
  contact_support: <SupportAgentIcon fontSize="small" />,
  check_history: <HelpOutlineIcon fontSize="small" />,
  add_funds: <AccountBalanceWalletIcon fontSize="small" />,
  reduce_amount: <HelpOutlineIcon fontSize="small" />,
  increase_amount: <HelpOutlineIcon fontSize="small" />,
  check_limits: <HelpOutlineIcon fontSize="small" />,
  check_tokens: <HelpOutlineIcon fontSize="small" />,
  use_dex: <SwapHorizIcon fontSize="small" />,
  find_pool: <HelpOutlineIcon fontSize="small" />,
  wait: <HelpOutlineIcon fontSize="small" />,
  split_transaction: <HelpOutlineIcon fontSize="small" />,
};

export function ErrorDisplay({
  error,
  onClose,
  onRecoveryAction,
  compact = false,
}: ErrorDisplayProps) {
  if (!error) return null;

  const handleRecoveryClick = (option: RecoveryOption) => {
    if (option.handler) {
      option.handler();
    } else if (onRecoveryAction) {
      onRecoveryAction(option.action);
    }
  };

  const getSeverity = (code: string): 'error' | 'warning' | 'info' => {
    // Warnings for recoverable errors
    const warningCodes = [
      'AMOUNT_TOO_LOW',
      'AMOUNT_TOO_HIGH',
      'WALLET_REJECTED',
      'NETWORK_ERROR',
    ];
    
    // Info for informational errors
    const infoCodes = [
      'ALREADY_MIGRATED',
      'MAX_SUPPLY_REACHED',
    ];

    if (warningCodes.includes(code)) return 'warning';
    if (infoCodes.includes(code)) return 'info';
    return 'error';
  };

  if (compact) {
    return (
      <Alert
        severity={getSeverity(error.code)}
        onClose={onClose}
        sx={{ mb: 2 }}
      >
        {error.message}
      </Alert>
    );
  }

  return (
    <Collapse in={!!error}>
      <Alert
        severity={getSeverity(error.code)}
        sx={{ mb: 2 }}
        action={
          onClose && (
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={onClose}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          )
        }
      >
        <AlertTitle sx={{ fontWeight: 600 }}>
          {getErrorTitle(error.code)}
        </AlertTitle>
        
        <Typography variant="body2" sx={{ mb: 2 }}>
          {error.message}
        </Typography>

        {error.recoveryOptions.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Önerilen Çözümler:
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {error.recoveryOptions.map((option, index) => (
                <Button
                  key={index}
                  size="small"
                  variant="outlined"
                  startIcon={ACTION_ICONS[option.action] || <HelpOutlineIcon fontSize="small" />}
                  onClick={() => handleRecoveryClick(option)}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    mb: 0.5,
                  }}
                >
                  {option.description}
                </Button>
              ))}
            </Stack>
          </Box>
        )}

        {/* Error Code for debugging */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            opacity: 0.6,
            fontFamily: 'monospace',
          }}
        >
          Hata Kodu: {error.code}
        </Typography>
      </Alert>
    </Collapse>
  );
}

// Helper: Get user-friendly error title
function getErrorTitle(code: string): string {
  const titles: Record<string, string> = {
    NOT_AUTHORIZED: 'Yetkilendirme Hatası',
    NULLIFIER_ALREADY_SPENT: 'Çift Harcama Tespit Edildi',
    INVALID_PROOF: 'Geçersiz ZK Kanıtı',
    PROOF_EXPIRED: 'Kanıt Süresi Doldu',
    ALREADY_MIGRATED: 'Havuz Taşındı',
    MAX_SUPPLY_REACHED: 'Maksimum Arz Limiti',
    INSUFFICIENT_BALANCE: 'Yetersiz Bakiye',
    INSUFFICIENT_RESERVE: 'Yetersiz Havuz Rezervi',
    INVALID_COMMITMENT: 'Geçersiz Commitment',
    TOKEN_NOT_SUPPORTED: 'Desteklenmeyen Token',
    AMOUNT_TOO_LOW: 'Miktar Çok Düşük',
    AMOUNT_TOO_HIGH: 'Miktar Çok Yüksek',
    TREE_FULL: 'Merkle Ağacı Dolu',
    INVALID_MERKLE_PROOF: 'Geçersiz Merkle Kanıtı',
    NETWORK_ERROR: 'Ağ Hatası',
    WALLET_REJECTED: 'İşlem Reddedildi',
    UNKNOWN: 'Beklenmeyen Hata',
  };

  return titles[code] || 'Hata';
}

export default ErrorDisplay;

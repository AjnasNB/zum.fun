/**
 * PrivacyDashboard Component
 * Main dashboard combining all privacy features
 * Requirements: 10.2, 10.3, 10.4, 10.5
 */

import React from 'react';
import { Box, Grid, Typography, Container } from '@mui/material';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { StealthAddressPanel } from './StealthAddressPanel';
import { TransactionHistory } from './TransactionHistory';
import { BalanceAggregation } from './BalanceAggregation';
import { ErrorDisplay } from './ErrorDisplay';
import { usePrivacyError } from '../../hooks/usePrivacyError';
import { useWallet } from '../../hooks/useWallet';

interface PrivacyDashboardProps {
  showTitle?: boolean;
}

export function PrivacyDashboard({ showTitle = true }: PrivacyDashboardProps) {
  const { isConnected } = useWallet();
  const { error, clearError, handleError } = usePrivacyError();

  const handleRecoveryAction = (action: string) => {
    switch (action) {
      case 'retry':
        clearError();
        break;
      case 'reconnect':
        // Trigger wallet reconnection
        window.location.reload();
        break;
      case 'contact_support':
        window.open('https://discord.gg/zumpfun', '_blank');
        break;
      default:
        clearError();
    }
  };

  return (
    <Container maxWidth="lg">
      {showTitle && (
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <VisibilityOffIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4" fontWeight={700}>
              Gizlilik Merkezi
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary">
            Stealth adreslerinizi yönetin, bakiyelerinizi görüntüleyin ve işlem geçmişinizi takip edin
          </Typography>
        </Box>
      )}

      {/* Error Display */}
      <ErrorDisplay
        error={error}
        onClose={clearError}
        onRecoveryAction={handleRecoveryAction}
      />

      {!isConnected ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <VisibilityOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Gizlilik özelliklerini kullanmak için cüzdanınızı bağlayın
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Stealth adresler oluşturun, bakiyelerinizi görüntüleyin ve işlemlerinizi takip edin
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Balance Aggregation - Full Width */}
          <Grid item xs={12}>
            <BalanceAggregation />
          </Grid>

          {/* Stealth Addresses and Transaction History - Side by Side */}
          <Grid item xs={12} md={6}>
            <StealthAddressPanel />
          </Grid>

          <Grid item xs={12} md={6}>
            <TransactionHistory maxItems={5} />
          </Grid>
        </Grid>
      )}
    </Container>
  );
}

export default PrivacyDashboard;

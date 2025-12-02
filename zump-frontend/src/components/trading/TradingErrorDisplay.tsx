/**
 * TradingErrorDisplay Component
 * Displays trading errors with recovery options
 * Requirements: 5.5, 6.5
 */

import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { TradingError, getErrorSeverity, requiresDexRedirect } from '../../utils/tradingErrors';

// ===========================================
// Types
// ===========================================

export interface TradingErrorDisplayProps {
  error: TradingError | null;
  onClose?: () => void;
  onRetry?: () => void;
}

// ===========================================
// Component
// ===========================================

export default function TradingErrorDisplay({
  error,
  onClose,
  onRetry,
}: TradingErrorDisplayProps) {
  if (!error) return null;

  const severity = getErrorSeverity(error.code);
  const showDexRedirect = requiresDexRedirect(error.code);

  return (
    <Alert 
      severity={severity}
      onClose={onClose}
      sx={{ mb: 2 }}
    >
      <AlertTitle>
        {severity === 'error' ? 'Hata' : severity === 'warning' ? 'Uyarı' : 'Bilgi'}
      </AlertTitle>
      
      {error.message}
      
      {/* Recovery Options */}
      {(error.recoveryOptions || showDexRedirect || onRetry) && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          {/* DEX Redirect Button - Requirements: 6.5 */}
          {showDexRedirect && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => window.open('https://app.avnu.fi', '_blank')}
            >
              DEX&apos;e Git
            </Button>
          )}
          
          {/* Custom Recovery Options */}
          {error.recoveryOptions?.map((option, index) => (
            <Button
              key={index}
              size="small"
              variant="outlined"
              color="inherit"
              onClick={option.action}
            >
              {option.label}
            </Button>
          ))}
          
          {/* Retry Button */}
          {onRetry && !showDexRedirect && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={onRetry}
            >
              Tekrar Dene
            </Button>
          )}
        </Stack>
      )}
    </Alert>
  );
}

export { TradingErrorDisplay };

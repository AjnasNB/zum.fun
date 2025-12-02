// @mui
import { Box, BoxProps, Alert, Typography, Stack, Button } from '@mui/material';
// @type
import { IDN404MetaData } from '../../../../@types/DN404';
// components
import { SkeletonProductItem } from '../../../../components/skeleton';
import Iconify from '../../../../components/iconify';
//
import DN404Card from './DN404Card';

// ----------------------------------------------------------------------

interface Props extends BoxProps {
  products: IDN404MetaData[];
  loading: boolean;
  error?: Error | string | null;
  onRetry?: () => void;
}

export default function DN404List({ products, loading, error, onRetry, ...other }: Props) {
  // Error state
  if (error && !loading) {
    return (
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <Alert 
          severity="error" 
          sx={{ mb: 3, justifyContent: 'center' }}
          action={
            onRetry && (
              <Button color="inherit" size="small" onClick={onRetry}>
                Retry
              </Button>
            )
          }
        >
          {typeof error === 'string' ? error : error.message || 'Failed to load tokens'}
        </Alert>
      </Box>
    );
  }

  // Empty state
  if (!loading && products.length === 0) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <Iconify icon="mdi:rocket-launch-outline" width={64} sx={{ color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            No tokens launched yet
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Be the first to launch a token on Zump.fun!
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      gap={3}
      display="grid"
      gridTemplateColumns={{
        xs: 'repeat(1, 1fr)',
        sm: 'repeat(2, 1fr)',
        md: 'repeat(3, 1fr)',
        lg: 'repeat(4, 1fr)',
      }}
      {...other}
    >
      {(loading ? [...Array(12)] : products).map((product, index) =>
        product ? (
          <DN404Card key={product.id} product={product} />
        ) : (
          <SkeletonProductItem key={index} />
        )
      )}
    </Box>
  );
}

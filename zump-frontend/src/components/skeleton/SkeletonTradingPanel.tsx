// @mui
import { Card, Skeleton, Stack, Box, Divider, CardProps } from '@mui/material';

// ----------------------------------------------------------------------

export default function SkeletonTradingPanel({ ...other }: CardProps) {
  return (
    <Card sx={{ p: 3 }} {...other}>
      {/* Tabs */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Skeleton variant="rounded" width={80} height={36} />
        <Skeleton variant="rounded" width={80} height={36} />
      </Stack>

      <Stack spacing={2}>
        {/* Amount Input */}
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Skeleton variant="text" width={100} />
            <Skeleton variant="text" width={80} />
          </Stack>
          <Skeleton variant="rounded" height={56} />
        </Box>

        {/* Swap Icon */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Skeleton variant="circular" width={40} height={40} />
        </Box>

        {/* Calculated Value */}
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Skeleton variant="text" width={80} />
          </Stack>
          <Skeleton variant="rounded" height={56} />
        </Box>

        {/* Slippage */}
        <Stack direction="row" justifyContent="space-between">
          <Skeleton variant="text" width={120} />
          <Skeleton variant="text" width={40} />
        </Stack>

        <Divider />

        {/* Trade Summary */}
        <Box sx={{ p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Skeleton variant="text" width={60} />
              <Skeleton variant="text" width={80} />
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Skeleton variant="text" width={70} />
              <Skeleton variant="text" width={90} />
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Skeleton variant="text" width={80} />
              <Skeleton variant="text" width={60} />
            </Stack>
          </Stack>
        </Box>

        {/* Trade Button */}
        <Skeleton variant="rounded" height={48} />
      </Stack>
    </Card>
  );
}

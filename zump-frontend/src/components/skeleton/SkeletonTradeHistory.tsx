// @mui
import { Card, Skeleton, Stack, Box, Table, TableBody, TableCell, TableHead, TableRow, CardProps } from '@mui/material';

// ----------------------------------------------------------------------

export default function SkeletonTradeHistory({ ...other }: CardProps) {
  return (
    <Card {...other}>
      {/* Analytics Cards */}
      <Stack direction="row" spacing={2} sx={{ p: 2 }}>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ flex: 1, p: 2, bgcolor: 'background.neutral', borderRadius: 1 }}>
            <Skeleton variant="text" width={80} />
            <Skeleton variant="text" width={60} height={32} />
            <Skeleton variant="text" width={100} />
          </Box>
        ))}
      </Stack>

      {/* Tabs */}
      <Stack direction="row" spacing={2} sx={{ px: 2, py: 1, bgcolor: 'background.neutral' }}>
        <Skeleton variant="rounded" width={60} height={32} />
        <Skeleton variant="rounded" width={60} height={32} />
        <Skeleton variant="rounded" width={60} height={32} />
      </Stack>

      {/* Toolbar */}
      <Stack direction="row" justifyContent="space-between" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2}>
          <Skeleton variant="rounded" width={160} height={40} />
          <Skeleton variant="rounded" width={160} height={40} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
        </Stack>
      </Stack>

      {/* Table */}
      <Table>
        <TableHead>
          <TableRow>
            {['Date', 'Trader', 'Type', 'Amount', 'Price', 'Total', 'Tx'].map((header) => (
              <TableCell key={header}>
                <Skeleton variant="text" width={60} />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {[1, 2, 3, 4, 5].map((row) => (
            <TableRow key={row}>
              <TableCell><Skeleton variant="text" width={80} /></TableCell>
              <TableCell><Skeleton variant="text" width={100} /></TableCell>
              <TableCell><Skeleton variant="rounded" width={50} height={24} /></TableCell>
              <TableCell><Skeleton variant="text" width={60} /></TableCell>
              <TableCell><Skeleton variant="text" width={70} /></TableCell>
              <TableCell><Skeleton variant="text" width={70} /></TableCell>
              <TableCell><Skeleton variant="text" width={80} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
        <Skeleton variant="rounded" width={200} height={32} />
      </Stack>
    </Card>
  );
}

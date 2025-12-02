/**
 * DN404TradeHistory Component
 * Displays trade history from on-chain events
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { Helmet } from 'react-helmet-async';
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import {
  Tab,
  Tabs,
  Card,
  Table,
  Stack,
  Button,
  Tooltip,
  Divider,
  TableBody,
  Container,
  IconButton,
  TableContainer,
  Alert,
  CircularProgress,
  TextField,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// components
import Label from '../../components/label';
import Iconify from '../../components/iconify';
import Scrollbar from '../../components/scrollbar';
import { useSettingsContext } from '../../components/settings';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from '../../components/table';

// sections
import DN404TransactionAnalytic from '../../sections/@dashboard/invoice/DN404TransactionAnalytic';
import { TradeTableRow } from '../../sections/@dashboard/invoice/list';

// hooks
import { useTradeHistory, ParsedTradeEvent, TradeHistoryFilter } from '../../hooks/useTradeHistory';

// types
import { TradeType } from '../../@types/supabase';


// ===========================================
// Constants
// ===========================================

const TABLE_HEAD = [
  { id: 'timestamp', label: 'Date', align: 'left' },
  { id: 'trader', label: 'Trader', align: 'left' },
  { id: 'type', label: 'Type', align: 'left' },
  { id: 'amount', label: 'Amount', align: 'center' },
  { id: 'price', label: 'Price', align: 'left' },
  { id: 'total', label: 'Total', align: 'left' },
  { id: 'tx', label: 'Tx Hash', align: 'center' },
];

const TABS = [
  { value: 'all', label: 'All', color: 'info' as const },
  { value: 'buy', label: 'Buy', color: 'success' as const },
  { value: 'sell', label: 'Sell', color: 'error' as const },
];

// ===========================================
// Helper Functions
// ===========================================

/**
 * Format bigint to string for CSV
 */
function formatBigIntForCsv(value: bigint, decimals: number = 18): string {
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 8);
  return `${whole}.${fractionStr}`;
}

/**
 * Export trades to CSV
 * Requirements: 7.5
 */
function exportTradesToCsv(trades: ParsedTradeEvent[], filename: string = 'trade_history.csv'): void {
  const headers = ['Date', 'Time', 'Type', 'Trader', 'Amount', 'Price', 'Total', 'Tx Hash'];
  
  const rows = trades.map(trade => [
    trade.timestamp.toLocaleDateString(),
    trade.timestamp.toLocaleTimeString(),
    trade.type.toUpperCase(),
    trade.trader,
    formatBigIntForCsv(trade.amountTokens),
    formatBigIntForCsv(trade.price),
    formatBigIntForCsv(trade.costOrReturn),
    trade.txHash,
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===========================================
// Component Props
// ===========================================

interface DN404TradeHistoryProps {
  poolAddress?: string;
}


// ===========================================
// Component
// ===========================================

export default function DN404TradeHistory({ poolAddress: propPoolAddress }: DN404TradeHistoryProps = {}) {
  const theme = useTheme();
  const { themeStretch } = useSettingsContext();
  const { id: paramId } = useParams();
  
  // Get pool address from props or params
  const poolAddress = propPoolAddress || paramId || '';

  // Table state
  const {
    dense,
    page,
    order,
    orderBy,
    rowsPerPage,
    setPage,
    onSort,
    onChangeDense,
    onChangePage,
    onChangeRowsPerPage,
  } = useTable({ defaultOrderBy: 'timestamp' });

  // Filter state
  const [filterStatus, setFilterStatus] = useState<'all' | TradeType>('all');
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);

  // Build filter object
  const filter: TradeHistoryFilter = useMemo(() => ({
    type: filterStatus === 'all' ? null : filterStatus,
    startTime: filterStartDate,
    endTime: filterEndDate,
  }), [filterStatus, filterStartDate, filterEndDate]);

  // Trade history hook
  const {
    trades,
    filteredTrades,
    isLoading,
    error,
    fetchTrades,
    subscribe,
    unsubscribe,
    setFilter,
    totalBuys,
    totalSells,
    totalVolume,
  } = useTradeHistory({
    poolAddress: poolAddress || '',
    autoFetch: !!poolAddress,
    pollingInterval: 30000,
  });

  // Update filter when state changes
  useEffect(() => {
    setFilter(filter);
  }, [filter, setFilter]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (poolAddress) {
      subscribe();
      return () => unsubscribe();
    }
    return undefined;
  }, [poolAddress, subscribe, unsubscribe]);

  // Sort and paginate data
  const sortedData = useMemo(() => {
    const sorted = [...filteredTrades];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (orderBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'amount':
          comparison = Number(a.amountTokens - b.amountTokens);
          break;
        case 'price':
          comparison = Number(a.price - b.price);
          break;
        case 'total':
          comparison = Number(a.costOrReturn - b.costOrReturn);
          break;
        default:
          comparison = 0;
      }
      
      return order === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredTrades, order, orderBy]);

  const dataInPage = sortedData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const denseHeight = dense ? 56 : 76;
  const isFiltered = filterStatus !== 'all' || !!filterStartDate || !!filterEndDate;
  const isNotFound = !sortedData.length && (isFiltered || !isLoading);

  // Calculate stats
  const stats = useMemo(() => {
    const buyCount = trades.filter(t => t.type === 'buy').length;
    const sellCount = trades.filter(t => t.type === 'sell').length;
    const total = trades.length;
    
    const buyVolume = trades
      .filter(t => t.type === 'buy')
      .reduce((sum, t) => sum + t.costOrReturn, BigInt(0));
    
    const sellVolume = trades
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + t.costOrReturn, BigInt(0));
    
    return {
      total,
      buyCount,
      sellCount,
      buyPercent: total > 0 ? (buyCount / total) * 100 : 0,
      sellPercent: total > 0 ? (sellCount / total) * 100 : 0,
      buyVolume: Number(buyVolume / BigInt(10 ** 18)),
      sellVolume: Number(sellVolume / BigInt(10 ** 18)),
      totalVolume: Number(totalVolume / BigInt(10 ** 18)),
    };
  }, [trades, totalVolume]);

  // Tab counts
  const tabCounts = useMemo(() => ({
    all: trades.length,
    buy: totalBuys,
    sell: totalSells,
  }), [trades.length, totalBuys, totalSells]);

  // Handlers
  const handleFilterStatus = (_: React.SyntheticEvent, newValue: string) => {
    setPage(0);
    setFilterStatus(newValue as 'all' | TradeType);
  };

  const handleResetFilter = () => {
    setFilterStatus('all');
    setFilterStartDate(null);
    setFilterEndDate(null);
  };

  const handleExportCsv = () => {
    const filename = `trade_history_${poolAddress?.slice(0, 8) || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    exportTradesToCsv(filteredTrades, filename);
  };

  const handleRefresh = () => {
    fetchTrades();
  };

  // Show message if no pool address
  if (!poolAddress) {
    return (
      <Container maxWidth={themeStretch ? false : 'lg'}>
        <Alert severity="info" sx={{ mt: 2 }}>
          Select a token to view its trade history.
        </Alert>
      </Container>
    );
  }


  return (
    <div style={{ width: '100%' }}>
      <Helmet>
        <title>Trade History | Zump.fun</title>
      </Helmet>

      <Container maxWidth={themeStretch ? false : 'lg'}>
        {/* Analytics Cards */}
        <Card sx={{ mb: 5 }}>
          <Scrollbar>
            <Stack
              direction="row"
              divider={<Divider orientation="vertical" flexItem sx={{ borderStyle: 'dashed' }} />}
              sx={{ py: 2 }}
            >
              <DN404TransactionAnalytic
                title="Total Trades"
                total={stats.total}
                percent={100}
                price={stats.totalVolume}
                icon="ic:round-receipt"
                color={theme.palette.info.main}
              />

              <DN404TransactionAnalytic
                title="Buy Orders"
                total={stats.buyCount}
                percent={stats.buyPercent}
                price={stats.buyVolume}
                icon="eva:trending-up-fill"
                color={theme.palette.success.main}
              />

              <DN404TransactionAnalytic
                title="Sell Orders"
                total={stats.sellCount}
                percent={stats.sellPercent}
                price={stats.sellVolume}
                icon="eva:trending-down-fill"
                color={theme.palette.error.main}
              />
            </Stack>
          </Scrollbar>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => {}}>
            {error}
          </Alert>
        )}

        {/* Main Card */}
        <Card>
          {/* Tabs */}
          <Tabs
            value={filterStatus}
            onChange={handleFilterStatus}
            sx={{
              px: 2,
              bgcolor: 'background.neutral',
            }}
          >
            {TABS.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                icon={
                  <Label color={tab.color} sx={{ mr: 1 }}>
                    {tabCounts[tab.value as keyof typeof tabCounts]}
                  </Label>
                }
              />
            ))}
          </Tabs>

          <Divider />

          {/* Toolbar */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ p: 2.5 }}
          >
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Stack direction="row" spacing={2}>
                <DatePicker
                  label="Start Date"
                  value={filterStartDate}
                  onChange={(newValue: Date | null) => {
                    setPage(0);
                    setFilterStartDate(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} size="small" sx={{ width: 160 }} />
                  )}
                />
                <DatePicker
                  label="End Date"
                  value={filterEndDate}
                  onChange={(newValue: Date | null) => {
                    setPage(0);
                    setFilterEndDate(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} size="small" sx={{ width: 160 }} />
                  )}
                />
              </Stack>
            </LocalizationProvider>

            <Stack direction="row" spacing={1}>
              {isFiltered && (
                <Button
                  color="error"
                  onClick={handleResetFilter}
                  startIcon={<Iconify icon="eva:trash-2-outline" />}
                >
                  Clear
                </Button>
              )}
              
              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} disabled={isLoading}>
                  {isLoading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Iconify icon="eva:refresh-fill" />
                  )}
                </IconButton>
              </Tooltip>

              <Tooltip title="Export CSV">
                <IconButton onClick={handleExportCsv} disabled={filteredTrades.length === 0}>
                  <Iconify icon="eva:download-outline" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Table */}
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size={dense ? 'small' : 'medium'} sx={{ minWidth: 800 }}>
                <TableHeadCustom
                  order={order}
                  orderBy={orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={sortedData.length}
                  onSort={onSort}
                />

                <TableBody>
                  {isLoading && sortedData.length === 0 ? (
                    <TableEmptyRows height={denseHeight} emptyRows={5} />
                  ) : (
                    <>
                      {dataInPage.map((row) => (
                        <TradeTableRow key={row.id} row={row} />
                      ))}

                      <TableEmptyRows
                        height={denseHeight}
                        emptyRows={emptyRows(page, rowsPerPage, sortedData.length)}
                      />

                      <TableNoData isNotFound={isNotFound} />
                    </>
                  )}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={sortedData.length}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={onChangePage}
            onRowsPerPageChange={onChangeRowsPerPage}
            dense={dense}
            onChangeDense={onChangeDense}
          />
        </Card>
      </Container>
    </div>
  );
}

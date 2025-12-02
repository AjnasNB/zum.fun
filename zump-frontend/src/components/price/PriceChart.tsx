/**
 * PriceChart Component
 * Displays price over time chart from trade events
 * Requirements: 10.3
 */

import React, { useMemo, useEffect, useState } from 'react';
import { Box, Typography, Skeleton, ToggleButtonGroup, ToggleButton, useTheme } from '@mui/material';
import { ApexOptions } from 'apexcharts';
import Chart from 'react-apexcharts';
import { useTradeHistory, ParsedTradeEvent } from '../../hooks/useTradeHistory';
import { usePricePolling, PriceData } from '../../hooks/usePricePolling';
import useChart from '../chart/useChart';
import { formatBigIntWithDecimals } from '../../utils/bondingCurveUtils';

// ===========================================
// Types
// ===========================================

export interface PriceChartProps {
  poolAddress: string;
  height?: number;
  showTimeRangeSelector?: boolean;
  decimals?: number;
  displayDecimals?: number;
  quoteSymbol?: string;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';

// ===========================================
// Constants
// ===========================================

const TIME_RANGES: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  'all': Infinity,
};

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1h': '1 Saat',
  '24h': '24 Saat',
  '7d': '7 Gün',
  '30d': '30 Gün',
  'all': 'Tümü',
};

// ===========================================
// Helper Functions
// ===========================================

/**
 * Convert trade events to price points for chart
 * Requirements: 10.3 - Fetch historical prices from trade events
 */
function tradesToPricePoints(
  trades: ParsedTradeEvent[],
  decimals: number
): PricePoint[] {
  // Sort trades by timestamp (oldest first for chart)
  const sortedTrades = [...trades].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  return sortedTrades.map((trade) => ({
    timestamp: trade.timestamp.getTime(),
    price: Number(formatBigIntWithDecimals(trade.price, decimals, 8)),
  }));
}

/**
 * Filter price points by time range
 */
function filterByTimeRange(
  points: PricePoint[],
  range: TimeRange
): PricePoint[] {
  if (range === 'all') return points;

  const cutoff = Date.now() - TIME_RANGES[range];
  return points.filter((point) => point.timestamp >= cutoff);
}

/**
 * Add current price to chart data
 */
function addCurrentPrice(
  points: PricePoint[],
  currentPriceData: PriceData | null,
  decimals: number
): PricePoint[] {
  if (!currentPriceData) return points;

  const currentPoint: PricePoint = {
    timestamp: currentPriceData.lastUpdated.getTime(),
    price: Number(formatBigIntWithDecimals(currentPriceData.currentPrice, decimals, 8)),
  };

  // Check if we already have a point at this timestamp
  const lastPoint = points[points.length - 1];
  if (lastPoint && Math.abs(lastPoint.timestamp - currentPoint.timestamp) < 1000) {
    // Update the last point instead of adding a new one
    return [...points.slice(0, -1), currentPoint];
  }

  return [...points, currentPoint];
}

// ===========================================
// Component
// ===========================================

/**
 * PriceChart Component
 * 
 * Requirements:
 * - 10.3: Display price over time chart, show historical prices from trade events,
 *         update chart with new trades
 */
export const PriceChart: React.FC<PriceChartProps> = ({
  poolAddress,
  height = 350,
  showTimeRangeSelector = true,
  decimals = 18,
  displayDecimals = 4,
  quoteSymbol = 'STRK',
}) => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');

  // Fetch trade history for historical prices
  // Requirements: 10.3 - Fetch historical prices from trade events
  const {
    trades,
    isLoading: isLoadingTrades,
    error: tradesError,
    subscribe,
    unsubscribe,
  } = useTradeHistory({
    poolAddress,
    autoFetch: true,
    pollingInterval: 30000, // Poll for new trades every 30 seconds
  });

  // Get current price for real-time updates
  // Requirements: 10.3 - Update chart with new trades
  const { priceData } = usePricePolling({
    poolAddress,
    pollingInterval: 10000,
    enabled: true,
  });

  // Subscribe to trade events on mount
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  // Convert trades to price points and filter by time range
  const chartData = useMemo(() => {
    const pricePoints = tradesToPricePoints(trades, decimals);
    const filteredPoints = filterByTimeRange(pricePoints, timeRange);
    const withCurrentPrice = addCurrentPrice(filteredPoints, priceData, decimals);
    return withCurrentPrice;
  }, [trades, timeRange, priceData, decimals]);

  // Prepare chart series data
  const series = useMemo(() => {
    return [
      {
        name: 'Fiyat',
        data: chartData.map((point) => ({
          x: point.timestamp,
          y: point.price,
        })),
      },
    ];
  }, [chartData]);

  // Chart options
  const chartOptions = useChart({
    chart: {
      type: 'area',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 300,
        dynamicAnimation: {
          enabled: true,
          speed: 300,
        },
      },
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: true,
        type: 'x',
      },
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.1,
        stops: [0, 100],
      },
    },
    colors: [theme.palette.primary.main],
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        format: timeRange === '1h' ? 'HH:mm' : timeRange === '24h' ? 'HH:mm' : 'dd MMM',
      },
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      labels: {
        formatter: (value: number) => `${value.toFixed(displayDecimals)} ${quoteSymbol}`,
      },
      min: (min: number) => min * 0.95,
      max: (max: number) => max * 1.05,
    },
    tooltip: {
      x: {
        format: 'dd MMM yyyy HH:mm',
      },
      y: {
        formatter: (value: number) => `${value.toFixed(displayDecimals)} ${quoteSymbol}`,
      },
    },
    grid: {
      borderColor: theme.palette.divider,
      strokeDashArray: 3,
    },
    markers: {
      size: 0,
      hover: {
        size: 5,
      },
    },
  } as ApexOptions);

  // Handle time range change
  const handleTimeRangeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newRange: TimeRange | null
  ) => {
    if (newRange) {
      setTimeRange(newRange);
    }
  };

  // Loading state
  if (isLoadingTrades && chartData.length === 0) {
    return (
      <Box>
        {showTimeRangeSelector && (
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Skeleton variant="rounded" width={300} height={32} />
          </Box>
        )}
        <Skeleton variant="rounded" height={height} />
      </Box>
    );
  }

  // Error state
  if (tradesError && chartData.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.neutral',
          borderRadius: 1,
        }}
      >
        <Typography color="error">
          Fiyat grafiği yüklenemedi: {tradesError}
        </Typography>
      </Box>
    );
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.neutral',
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary">
          Henüz işlem verisi bulunmuyor
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Time Range Selector */}
      {showTimeRangeSelector && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={handleTimeRangeChange}
            size="small"
          >
            {(Object.keys(TIME_RANGES) as TimeRange[]).map((range) => (
              <ToggleButton key={range} value={range}>
                {TIME_RANGE_LABELS[range]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      {/* Price Chart */}
      {/* Requirements: 10.3 - Display price over time chart */}
      <Chart
        type="area"
        series={series}
        options={chartOptions}
        height={height}
      />
    </Box>
  );
};

export default PriceChart;

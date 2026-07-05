import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TradingViewChart } from './TradingViewChart';
import { colors, spacing } from '../constants/theme';
import { buildHistoricalChartHtml } from '../services/gapChartService';
import { CandleData, TimeRange } from '../types/stock';
import { formatPrice } from '../utils/format';

interface PriceChartProps {
  symbol: string;
  range: TimeRange;
  data: CandleData;
}

export function PriceChart({ symbol, range, data }: PriceChartProps) {
  const closes = data.closes;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const html = useMemo(() => buildHistoricalChartHtml(symbol, range, data), [symbol, range, data]);
  const reloadKey = `${symbol}-${range}-${data.timestamps.length}-${data.timestamps[0] ?? 0}`;

  return (
    <View style={styles.container}>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>Low {formatPrice(min)}</Text>
        <Text style={styles.chartMode}>Candlestick · TradingView</Text>
        <Text style={styles.rangeLabel}>High {formatPrice(max)}</Text>
      </View>
      <TradingViewChart html={html} height={360} reloadKey={reloadKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  chartMode: {
    color: '#26a69a',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

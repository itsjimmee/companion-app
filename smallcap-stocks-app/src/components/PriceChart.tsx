import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, spacing } from '../constants/theme';
import { CandleData } from '../types/stock';
import { formatPrice } from '../utils/format';

interface PriceChartProps {
  data: CandleData;
  positive?: boolean;
}

export function PriceChart({ data, positive = true }: PriceChartProps) {
  const screenWidth = Dimensions.get('window').width - spacing.md * 2;
  const closes = data.closes;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const lineColor = positive ? colors.success : colors.danger;

  const labels = data.timestamps.map((_, i) => {
    if (closes.length <= 6) return '';
    const step = Math.floor(closes.length / 5);
    return i % step === 0 ? `${i}` : '';
  });

  return (
    <View style={styles.container}>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>Low {formatPrice(min)}</Text>
        <Text style={styles.rangeLabel}>High {formatPrice(max)}</Text>
      </View>
      <LineChart
        data={{
          labels,
          datasets: [{ data: closes.length > 1 ? closes : [closes[0], closes[0]] }],
        }}
        width={screenWidth}
        height={220}
        withDots={false}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLabels={false}
        chartConfig={{
          backgroundGradientFrom: colors.surface,
          backgroundGradientTo: colors.surface,
          color: () => lineColor,
          labelColor: () => colors.textMuted,
          strokeWidth: 2,
          propsForBackgroundLines: { stroke: colors.border },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -spacing.sm,
  },
});

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PriceChart } from '../components/PriceChart';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { useWatchlist } from '../context/WatchlistContext';
import { useHistoricalData } from '../hooks/useHistoricalData';
import { fetchQuote, isDemoMode } from '../services/polygonApi';
import { fetchTickerOverview, TickerOverview } from '../services/tickerOverviewService';
import { TimeRange } from '../types/stock';
import {
  formatChange,
  formatMarketCap,
  formatPercent,
  formatPrice,
  formatVolume,
} from '../utils/format';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'StockDetail'>;

const TIME_RANGES: TimeRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];

export function StockDetailScreen({ route, navigation }: Props) {
  const { symbol, name } = route.params;
  const [range, setRange] = useState<TimeRange>('1M');
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof fetchQuote>> | null>(null);
  const [overview, setOverview] = useState<TickerOverview | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const { isInWatchlist, toggleWatchlist } = useWatchlist();
  const { data, loading: chartLoading, error: chartError } = useHistoricalData(symbol, range);

  const inWatchlist = isInWatchlist(symbol);
  const gapPercent = quote?.previousClose
    ? ((quote.open - quote.previousClose) / quote.previousClose) * 100
    : 0;

  useEffect(() => {
    setQuoteLoading(true);
    Promise.all([fetchQuote(symbol), fetchTickerOverview(symbol)])
      .then(([q, ov]) => {
        setQuote(q);
        setOverview(ov);
      })
      .finally(() => setQuoteLoading(false));
  }, [symbol]);

  if (quoteLoading) return <LoadingView message={`Loading ${symbol}...`} />;

  const isPositive = (quote?.changePercent ?? 0) >= 0;
  const changeColor = isPositive ? colors.success : colors.danger;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.symbol}>{symbol}</Text>
            <Text style={styles.name}>{overview?.profile.name || name || quote?.name}</Text>
            {overview?.profile.exchange ? (
              <Text style={styles.exchange}>{overview.profile.exchange}</Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() =>
                navigation.navigate('GapDay', { symbol, date: new Date().toISOString().slice(0, 10) })
              }
              style={styles.chartBtn}
            >
              <Text style={styles.chartBtnText}>Gap Chart</Text>
            </Pressable>
            <Pressable onPress={() => toggleWatchlist(symbol)} style={styles.starButton}>
              <Text style={[styles.star, inWatchlist && styles.starActive]}>
                {inWatchlist ? '★' : '☆'}
              </Text>
            </Pressable>
          </View>
        </View>

        {isDemoMode() && (
          <View style={styles.demoBanner}>
            <Text style={styles.demoText}>Demo mode — add EXPO_PUBLIC_POLYGON_API_KEY for live Polygon data</Text>
          </View>
        )}

        <View style={styles.priceSection}>
          <Text style={styles.price}>{formatPrice(quote?.price ?? 0)}</Text>
          <Text style={[styles.change, { color: changeColor }]}>
            {formatChange(quote?.change ?? 0)} ({formatPercent(quote?.changePercent ?? 0)})
          </Text>
          <Text style={styles.gap}>Gap {formatPercent(gapPercent)}</Text>
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Open" value={formatPrice(quote?.open ?? 0)} />
          <Stat label="High" value={formatPrice(quote?.high ?? 0)} />
          <Stat label="Low" value={formatPrice(quote?.low ?? 0)} />
          <Stat label="Volume" value={formatVolume(quote?.volume ?? 0)} />
          {overview?.display?.marketCap ? (
            <Stat label="Mkt Cap" value={overview.display.marketCap} />
          ) : quote?.marketCap ? (
            <Stat label="Mkt Cap" value={formatMarketCap(quote.marketCap)} />
          ) : null}
          {overview?.display?.sharesOutstanding ? (
            <Stat label="Shares" value={overview.display.sharesOutstanding} />
          ) : null}
        </View>

        {overview?.returns ? (
          <View style={styles.returnsRow}>
            {(['1W', '1M', '3M', '6M', '1Y', 'YTD'] as const).map((key) => {
              const val = overview.returns?.[key];
              if (val == null) return null;
              return (
                <View key={key} style={styles.returnChip}>
                  <Text style={styles.returnLabel}>{key}</Text>
                  <Text style={[styles.returnValue, { color: val >= 0 ? colors.success : colors.danger }]}>
                    {formatPercent(val)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.rangeSelector}>
          {TIME_RANGES.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangeChip, range === r && styles.rangeChipActive]}
            >
              <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r}</Text>
            </Pressable>
          ))}
        </View>

        {chartLoading ? (
          <LoadingView message="Loading chart..." />
        ) : chartError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{chartError}</Text>
          </View>
        ) : data ? (
          <PriceChart symbol={symbol} range={range} data={data} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  symbol: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  name: { color: colors.textSecondary, fontSize: 16, marginTop: 2 },
  exchange: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chartBtn: {
    backgroundColor: '#00d4aa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chartBtnText: { color: '#1a1a2e', fontWeight: '700', fontSize: 12 },
  starButton: { padding: spacing.sm },
  star: { fontSize: 28, color: colors.textMuted },
  starActive: { color: colors.warning },
  demoBanner: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 10,
    padding: spacing.sm,
  },
  demoText: { color: colors.warning, fontSize: 12 },
  priceSection: { gap: 4 },
  price: { color: colors.text, fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  change: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  gap: { color: '#00d4aa', fontSize: 15, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    minWidth: '30%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  returnsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  returnChip: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 56,
    alignItems: 'center',
  },
  returnLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  returnValue: { fontSize: 13, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  rangeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  rangeTextActive: { color: colors.text },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14 },
});

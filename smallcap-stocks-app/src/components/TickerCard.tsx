import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { gapColorClass, ScanType } from '../services/scannerService';
import { ScannerResult } from '../types/stock';
import { formatChange, formatPercent, formatPrice, formatVolume, formatMarketCap } from '../utils/format';

interface TickerCardProps {
  quote: ScannerResult;
  onPress?: () => void;
  rank?: number;
  scanType?: ScanType;
}

/** V08-style ticker card with gap %, HOD push, VWAP, volume */
export function TickerCard({ quote, onPress, rank, scanType = 'gaps' }: TickerCardProps) {
  const isPositive = quote.changePercent >= 0;
  const changeColor = isPositive ? colors.success : colors.danger;
  const displayMove = quote.percentageGain ?? quote.gapPercent;
  const gapClass = gapColorClass(displayMove);
  const gapColor =
    gapClass === 'green' ? colors.success : gapClass === 'yellow' ? colors.warning : '#ff9100';

  const moveLabel =
    scanType === 'premarket' || scanType === 'afterhours'
      ? 'Gain'
      : scanType === 'intraday'
        ? 'Run'
        : scanType === 'day2'
          ? 'D2 Run'
          : 'HOD Push';

  const moveValue =
    scanType === 'premarket' || scanType === 'afterhours'
      ? quote.percentageGain
      : scanType === 'intraday' || scanType === 'day2'
        ? quote.intradayRunPct
        : quote.hodPushPct;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.symbolBlock}>
          {rank != null && <Text style={styles.rank}>#{rank}</Text>}
          <Text style={styles.symbol}>{quote.symbol}</Text>
          <Text style={styles.name} numberOfLines={1}>{quote.name}</Text>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{formatPrice(quote.price)}</Text>
          <Text style={[styles.change, { color: changeColor }]}>
            {formatChange(quote.change)} ({formatPercent(quote.changePercent)})
          </Text>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Gap" value={formatPercent(quote.gapPercent)} color={gapColor} />
        {moveValue != null ? (
          <Metric label={moveLabel} value={formatPercent(moveValue)} color={colors.primary} />
        ) : null}
        <Metric label="Vol" value={formatVolume(quote.volume)} />
        {quote.closedOverVwap != null && (
          <Metric
            label="VWAP"
            value={quote.closedOverVwap ? 'Above' : 'Below'}
            color={quote.closedOverVwap ? colors.success : colors.danger}
          />
        )}
        {quote.relativeVolume != null && (
          <Metric label="Rel Vol" value={`${quote.relativeVolume.toFixed(1)}x`} />
        )}
        {quote.marketCap != null && (
          <Metric label="Mkt Cap" value={formatMarketCap(quote.marketCap)} />
        )}
        {scanType === 'day2' && quote.day1RunPct != null && (
          <Metric label="D1 Run" value={formatPercent(quote.day1RunPct)} color={colors.warning} />
        )}
        {quote.isPopDrop && <Metric label="Pop" value="Drop" color={colors.danger} />}
        {quote.pmhBreak && <Metric label="PMH" value="Break" color={colors.success} />}
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footer}>O {formatPrice(quote.open)} · H {formatPrice(quote.high)} · L {formatPrice(quote.low)}</Text>
        {quote.dollarVolume != null && (
          <Text style={styles.footer}>${formatVolume(quote.dollarVolume)} vol</Text>
        )}
      </View>
    </Pressable>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85, backgroundColor: colors.surfaceElevated },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  symbolBlock: { flex: 1, marginRight: spacing.md },
  rank: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  symbol: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  name: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  priceBlock: { alignItems: 'flex-end' },
  price: { color: colors.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  change: { fontSize: 13, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { minWidth: 64 },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  footer: { color: colors.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { formatChange, formatPercent, formatPrice, formatVolume } from '../utils/format';
import { StockQuote } from '../types/stock';

interface StockCardProps {
  quote: StockQuote;
  onPress?: () => void;
  showVolume?: boolean;
  compact?: boolean;
}

export function StockCard({ quote, onPress, showVolume = true, compact = false }: StockCardProps) {
  const isPositive = quote.changePercent >= 0;
  const changeColor = isPositive ? colors.success : colors.danger;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, compact && styles.compact, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <Text style={styles.symbol}>{quote.symbol}</Text>
        {!compact && <Text style={styles.name} numberOfLines={1}>{quote.name}</Text>}
      </View>

      <View style={styles.right}>
        <Text style={styles.price}>{formatPrice(quote.price)}</Text>
        <View style={styles.changeRow}>
          <Text style={[styles.change, { color: changeColor }]}>
            {formatChange(quote.change)} ({formatPercent(quote.changePercent)})
          </Text>
        </View>
        {showVolume && (
          <Text style={styles.volume}>Vol {formatVolume(quote.volume)}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: {
    paddingVertical: spacing.sm + 2,
  },
  pressed: {
    opacity: 0.85,
    backgroundColor: colors.surfaceElevated,
  },
  left: {
    flex: 1,
    marginRight: spacing.md,
  },
  symbol: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  price: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  changeRow: {
    marginTop: 2,
  },
  change: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  volume: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
});

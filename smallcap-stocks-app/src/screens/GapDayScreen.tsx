import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GapDayChart } from '../components/GapDayChart';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { useGapDayChart } from '../hooks/useGapDayChart';
import { ALLOWED_CANDLE_MINUTES, CandleMinutes } from '../services/gapChartService';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GapDay'>;

export function GapDayScreen({ route }: Props) {
  const { symbol, date } = route.params;
  const [candleMinutes, setCandleMinutes] = useState<CandleMinutes>(3);
  const [forwardDays, setForwardDays] = useState(1);
  const { payload, loading, error, reload } = useGapDayChart(symbol, date, candleMinutes, forwardDays);

  if (loading && !payload) return <LoadingView message={`Loading ${symbol} ${date}…`} />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={styles.date}>{date}</Text>

        <Text style={styles.sectionLabel}>Candle size</Text>
        <View style={styles.chips}>
          {ALLOWED_CANDLE_MINUTES.map((m) => (
            <Pressable
              key={m}
              style={[styles.chip, candleMinutes === m && styles.chipActive]}
              onPress={() => setCandleMinutes(m)}
            >
              <Text style={[styles.chipText, candleMinutes === m && styles.chipTextActive]}>{m}m</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Forward days</Text>
        <View style={styles.chips}>
          {[0, 1, 2, 3].map((d) => (
            <Pressable
              key={d}
              style={[styles.chip, forwardDays === d && styles.chipActive]}
              onPress={() => setForwardDays(d)}
            >
              <Text style={[styles.chipText, forwardDays === d && styles.chipTextActive]}>
                {d === 0 ? 'Off' : `+${d}d`}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.reloadBtn} onPress={reload}>
          <Text style={styles.reloadText}>Reload chart</Text>
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : payload ? (
          <GapDayChart payload={payload} height={520} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  symbol: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  date: { color: '#00d4aa', fontSize: 16, fontWeight: '600' },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.text },
  reloadBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reloadText: { color: colors.primary, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14 },
});

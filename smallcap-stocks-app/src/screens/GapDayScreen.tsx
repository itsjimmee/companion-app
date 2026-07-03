import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GapDayChart } from '../components/GapDayChart';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { useGapDayChart } from '../hooks/useGapDayChart';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GapDay'>;

export function GapDayScreen({ route }: Props) {
  const { symbol, date } = route.params;
  const { payload, loading, error } = useGapDayChart(symbol, date);

  if (loading) return <LoadingView message={`Loading ${symbol} ${date}...`} />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.symbol}>{symbol}</Text>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.hint}>3-min candles · VWAP · Premarket / After-hours sessions</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : payload ? (
          <GapDayChart payload={payload} height={420} />
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
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 14 },
});

import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerField } from '../components/DatePickerField';
import { ScannerFilters } from '../components/ScannerFilters';
import { TickerCard } from '../components/TickerCard';
import { hasPolygonKey } from '../constants/apiKeys';
import { colors, spacing } from '../constants/theme';
import { useScanner } from '../hooks/useScanner';
import { isDemoMode } from '../services/polygonApi';
import { SCAN_RANGE_MAX_DAYS } from '../services/polygonScanService';
import { ScanType } from '../services/scannerService';
import { DEFAULT_SCANNER_FILTER } from '../types/stock';
import { todayEt, weekdaysBetween } from '../utils/dates';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Scanner'>,
  NativeStackScreenProps<RootStackParamList>
>;

const SCAN_TYPES: { key: ScanType; label: string }[] = [
  { key: 'gaps', label: 'Gaps' },
  { key: 'intraday', label: 'Intraday' },
  { key: 'premarket', label: 'Premarket' },
  { key: 'afterhours', label: 'After Hours' },
  { key: 'day2', label: 'Day 2' },
];

export function ScannerScreen({ navigation }: Props) {
  const [filter, setFilter] = useState(DEFAULT_SCANNER_FILTER);
  const [scanType, setScanType] = useState<ScanType>('gaps');
  const [dateFrom, setDateFrom] = useState(todayEt());
  const [dateTo, setDateTo] = useState(todayEt());

  const { results, scanning, error, lastUpdated, rangeNote, startScan, stopScan } = useScanner({
    dateFrom,
    dateTo,
    filter,
    scanType,
  });

  const scanLabel = SCAN_TYPES.find((s) => s.key === scanType)?.label ?? 'Gaps';
  const isRange = dateFrom !== dateTo;
  const rangeDays = isRange ? weekdaysBetween(dateFrom, dateTo) : 1;
  const rangeTooLarge = rangeDays > SCAN_RANGE_MAX_DAYS;

  const onScan = () => {
    if (rangeTooLarge) return;
    startScan();
  };

  const onFromChange = (d: string) => {
    setDateFrom(d);
    if (d > dateTo) setDateTo(d);
  };

  const onToChange = (d: string) => {
    setDateTo(d);
    if (d < dateFrom) setDateFrom(d);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[colors.surface, colors.background]} style={styles.header}>
        <Text style={styles.title}>Small Cap Scanner</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, hasPolygonKey() ? styles.dotLive : styles.dotIdle]} />
          <Text style={styles.statusText}>
            {scanning ? 'Scanning…' : hasPolygonKey() ? 'Ready · tap Scan' : 'Demo'}
            {lastUpdated && !scanning ? ` · ${lastUpdated.toLocaleTimeString()}` : ''}
          </Text>
          {isDemoMode() && <Text style={styles.demoBadge}>NO KEY</Text>}
        </View>
      </LinearGradient>

      <View style={styles.dateRow}>
        <DatePickerField label="From" value={dateFrom} onChange={onFromChange} maximumDate={dateTo} />
        <DatePickerField label="To" value={dateTo} onChange={onToChange} minimumDate={dateFrom} />
        <Pressable
          style={styles.todayBtn}
          onPress={() => {
            const t = todayEt();
            setDateFrom(t);
            setDateTo(t);
          }}
        >
          <Text style={styles.todayBtnText}>Today</Text>
        </Pressable>
      </View>

      {rangeTooLarge ? (
        <Text style={styles.rangeWarn}>
          Range is {rangeDays} weekdays (max {SCAN_RANGE_MAX_DAYS}). Narrow dates to scan.
        </Text>
      ) : isRange ? (
        <Text style={styles.rangeNote}>{rangeDays} weekdays · up to {SCAN_RANGE_MAX_DAYS} allowed</Text>
      ) : null}
      {rangeNote ? <Text style={styles.rangeNote}>{rangeNote}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.scanBtn, (scanning || rangeTooLarge) && styles.btnDisabled]}
          onPress={onScan}
          disabled={scanning || rangeTooLarge}
        >
          {scanning ? (
            <ActivityIndicator color="#1a1a2e" />
          ) : (
            <Text style={styles.scanBtnText}>Scan</Text>
          )}
        </Pressable>
        {scanning ? (
          <Pressable style={styles.stopBtn} onPress={stopScan}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.scanTypes}>
        {SCAN_TYPES.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.scanChip, scanType === s.key && styles.scanChipActive]}
            onPress={() => setScanType(s.key)}
          >
            <Text style={[styles.scanChipText, scanType === s.key && styles.scanChipTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScannerFilters filter={filter} onChange={setFilter} />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => `${item.symbol}-${item.scanDate ?? 'x'}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.resultCount}>
            {results.length} {scanLabel.toLowerCase()}
            {isRange ? ` · ${dateFrom} → ${dateTo}` : ` · ${dateFrom}`}
          </Text>
        }
        ListEmptyComponent={
          !scanning ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No results yet</Text>
              <Text style={styles.emptySubtitle}>Set dates and tap Scan</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <TickerCard
            quote={item}
            rank={index + 1}
            scanType={scanType}
            onPress={() =>
              navigation.navigate('StockDetail', {
                symbol: item.symbol,
                name: item.name,
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  dateRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xs,
    alignItems: 'flex-end',
  },
  todayBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 2,
  },
  todayBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  rangeNote: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.md, marginBottom: 4 },
  rangeWarn: { color: colors.warning, fontSize: 12, paddingHorizontal: spacing.md, marginBottom: 4 },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scanBtn: {
    flex: 1,
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnText: { color: '#1a1a2e', fontWeight: '800', fontSize: 16 },
  stopBtn: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  stopBtnText: { color: colors.danger, fontWeight: '800', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  scanTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scanChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scanChipActive: { backgroundColor: '#00d4aa', borderColor: '#00d4aa' },
  scanChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  scanChipTextActive: { color: '#1a1a2e' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotLive: { backgroundColor: colors.success },
  dotIdle: { backgroundColor: colors.warning },
  statusText: { color: colors.textSecondary, fontSize: 13 },
  demoBadge: {
    backgroundColor: colors.warning,
    color: colors.background,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  resultCount: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  errorBox: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: colors.textSecondary, marginTop: spacing.xs },
});

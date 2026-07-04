import { useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerField } from '../components/DatePickerField';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { defaultGapViewerRange, GAP_VIEWER_MAX_DAYS, useGapViewer } from '../hooks/useGapViewer';
import { gapColorClass } from '../services/scannerService';
import { AfterhoursRow, GapDayRow, GapViewerTab, PremarketRow } from '../types/stock';
import { formatPercent, formatVolume } from '../utils/format';
import { weekdaysBetween } from '../utils/dates';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Gaps'>,
  NativeStackScreenProps<RootStackParamList>
>;

const TABS: { key: GapViewerTab; label: string }[] = [
  { key: 'gaps', label: 'Gaps' },
  { key: 'premarket', label: 'Premarket' },
  { key: 'afterhours', label: 'After Hours' },
  { key: 'intraday_runners', label: 'Intraday' },
];

export function GapViewerScreen({ navigation }: Props) {
  const defaultRange = defaultGapViewerRange();
  const [ticker, setTicker] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [tab, setTab] = useState<GapViewerTab>('gaps');
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const { rows, loading, error, loaded, startScan, stopScan } = useGapViewer(
    activeTicker,
    tab,
    dateFrom,
    dateTo
  );

  const rangeDays = weekdaysBetween(dateFrom, dateTo);
  const rangeTooLarge = rangeDays > GAP_VIEWER_MAX_DAYS;

  const onFromChange = (d: string) => {
    setDateFrom(d);
    if (d > dateTo) setDateTo(d);
  };

  const onToChange = (d: string) => {
    setDateTo(d);
    if (d < dateFrom) setDateFrom(d);
  };

  const onScan = () => {
    const t = ticker.trim().toUpperCase();
    if (!t || rangeTooLarge) return;
    if (t !== activeTicker) setActiveTicker(t);
    else startScan();
  };

  useEffect(() => {
    if (activeTicker) startScan();
  }, [activeTicker]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Gap Chart Viewer</Text>
        <Text style={styles.subtitle}>Polygon minute-bar history · tap row for intraday chart</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Ticker (e.g. SOFI)"
          placeholderTextColor={colors.textMuted}
          value={ticker}
          onChangeText={setTicker}
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={onScan}
        />
      </View>

      <View style={styles.dateRow}>
        <DatePickerField label="From" value={dateFrom} onChange={onFromChange} maximumDate={dateTo} />
        <DatePickerField label="To" value={dateTo} onChange={onToChange} minimumDate={dateFrom} />
      </View>

      {rangeTooLarge ? (
        <Text style={styles.rangeWarn}>
          Range {rangeDays} weekdays exceeds max {GAP_VIEWER_MAX_DAYS}
        </Text>
      ) : (
        <Text style={styles.rangeNote}>{rangeDays} weekdays · max {GAP_VIEWER_MAX_DAYS}</Text>
      )}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.scanBtn, (loading || rangeTooLarge || !ticker.trim()) && styles.btnDisabled]}
          onPress={onScan}
          disabled={loading || rangeTooLarge || !ticker.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#1a1a2e" />
          ) : (
            <Text style={styles.scanBtnText}>{loaded ? 'Reload' : 'Scan'}</Text>
          )}
        </Pressable>
        {loading ? (
          <Pressable style={styles.stopBtn} onPress={stopScan}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !rows.length ? (
        <LoadingView message={`Scanning ${activeTicker || 'ticker'} ${tab}…`} />
      ) : (
        <FlatList
          data={rows as (GapDayRow | PremarketRow | AfterhoursRow)[]}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            activeTicker ? (
              <Text style={styles.listHeader}>
                {activeTicker} · {rows.length} {tab} rows · {dateFrom} → {dateTo}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{activeTicker ? 'No data in range' : 'Enter a ticker'}</Text>
              <Text style={styles.emptySubtitle}>
                {activeTicker ? 'Try another tab or widen dates' : 'Tap Scan to load history'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <GapRow
              item={item}
              tab={tab}
              onPress={() =>
                navigation.navigate('GapDay', {
                  symbol: activeTicker,
                  date: item.date,
                })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function GapRow({
  item,
  tab,
  onPress,
}: {
  item: GapDayRow | PremarketRow | AfterhoursRow;
  tab: GapViewerTab;
  onPress: () => void;
}) {
  if (tab === 'gaps' || tab === 'intraday_runners') {
    const row = item as GapDayRow;
    const gapClass = gapColorClass(row.gapPercent);
    const gapColor =
      gapClass === 'green' ? colors.success : gapClass === 'yellow' ? colors.warning : '#ff9100';
    return (
      <Pressable style={styles.row} onPress={onPress}>
        <View style={styles.rowLeft}>
          <Text style={styles.date}>{row.date}</Text>
          <Text style={styles.rowMeta}>
            Vol {formatVolume(row.volume)}
            {row.premarketVolume != null ? ` · PM ${formatVolume(row.premarketVolume)}` : ''}
          </Text>
        </View>
        <View style={styles.rowRight}>
          {tab === 'intraday_runners' && row.hodPushPct != null ? (
            <Text style={[styles.gapPct, { color: colors.success }]}>Run {formatPercent(row.hodPushPct)}</Text>
          ) : (
            <Text style={[styles.gapPct, { color: gapColor }]}>{formatPercent(row.gapPercent)}</Text>
          )}
          {row.marketClose != null && (
            <Text style={styles.rowMeta}>Close ${row.marketClose.toFixed(2)}</Text>
          )}
          {row.dayChangePercent != null && (
            <Text style={styles.rowMeta}>Day {formatPercent(row.dayChangePercent)}</Text>
          )}
          {row.closedOverVwap != null && (
            <Text style={[styles.vwap, { color: row.closedOverVwap ? colors.success : colors.danger }]}>
              VWAP {row.closedOverVwap ? '✓' : '✗'}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  const row = item as PremarketRow | AfterhoursRow;
  const gain = row.percentageGain;
  const dollarVol =
    tab === 'premarket' ? (row as PremarketRow).premarketDollarVolume : (row as AfterhoursRow).afterhoursDollarVolume;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Text style={styles.date}>{row.date}</Text>
        <Text style={styles.rowMeta}>
          Spike {row.spikeDurationMinutes ?? 0}m
          {dollarVol != null ? ` · $${formatVolume(dollarVol)}` : ''}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.gapPct, { color: gain >= 0 ? colors.success : colors.danger }]}>
          {formatPercent(gain)}
        </Text>
        {row.gapped != null && (
          <Text style={[styles.vwap, { color: row.gapped ? colors.success : colors.textMuted }]}>
            Gapped {row.gapped ? 'Yes' : 'No'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  searchRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
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
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  listHeader: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end' },
  date: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  gapPct: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  vwap: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  errorBox: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 2 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: colors.textSecondary, marginTop: spacing.xs },
});

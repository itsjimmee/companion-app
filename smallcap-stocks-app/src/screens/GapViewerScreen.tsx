import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { useGapViewer } from '../hooks/useGapViewer';
import { gapColorClass } from '../services/scannerService';
import { AfterhoursRow, GapDayRow, GapViewerTab, PremarketRow } from '../types/stock';
import { formatPercent, formatVolume } from '../utils/format';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Gaps'>,
  NativeStackScreenProps<RootStackParamList>
>;

const TABS: { key: GapViewerTab; label: string }[] = [
  { key: 'gaps', label: 'Gaps' },
  { key: 'premarket', label: 'Premarket' },
  { key: 'afterhours', label: 'After Hours' },
];

export function GapViewerScreen({ navigation }: Props) {
  const [ticker, setTicker] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [tab, setTab] = useState<GapViewerTab>('gaps');
  const { rows, loading, error, reload } = useGapViewer(activeTicker, tab);

  const loadTicker = () => {
    const t = ticker.trim().toUpperCase();
    if (t) setActiveTicker(t);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Gap Chart Viewer</Text>
        <Text style={styles.subtitle}>Historical gaps, premarket & after-hours — tap a row for intraday chart</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter ticker (e.g. SOFI)"
          placeholderTextColor={colors.textMuted}
          value={ticker}
          onChangeText={setTicker}
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={loadTicker}
        />
        <Pressable style={styles.loadBtn} onPress={loadTicker}>
          <Text style={styles.loadBtnText}>Load</Text>
        </Pressable>
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
        <LoadingView message={`Loading ${tab} for ${activeTicker || 'ticker'}...`} />
      ) : (
        <FlatList
          data={rows as (GapDayRow | PremarketRow | AfterhoursRow)[]}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{activeTicker ? 'No data' : 'Enter a ticker'}</Text>
              <Text style={styles.emptySubtitle}>
                {activeTicker ? 'Try another tab or ticker' : 'Type a symbol and tap Load'}
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
  if (tab === 'gaps') {
    const row = item as GapDayRow;
    const gapClass = gapColorClass(row.gapPercent);
    const gapColor =
      gapClass === 'green' ? colors.success : gapClass === 'yellow' ? colors.warning : '#ff9100';
    return (
      <Pressable style={styles.row} onPress={onPress}>
        <View style={styles.rowLeft}>
          <Text style={styles.date}>{row.date}</Text>
          <Text style={styles.rowMeta}>Vol {formatVolume(row.volume)}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.gapPct, { color: gapColor }]}>{formatPercent(row.gapPercent)}</Text>
          {row.marketClose != null && (
            <Text style={styles.rowMeta}>Close ${row.marketClose.toFixed(2)}</Text>
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
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        <Text style={styles.date}>{row.date}</Text>
        <Text style={styles.rowMeta}>
          {tab === 'premarket' ? 'PM' : 'AH'} spike {row.spikeDurationMinutes ?? '—'}m
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
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loadBtn: {
    backgroundColor: '#00d4aa',
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  loadBtnText: { color: '#1a1a2e', fontWeight: '800', fontSize: 15 },
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

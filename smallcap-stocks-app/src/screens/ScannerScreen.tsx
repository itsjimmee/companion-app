import { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScannerFilters } from '../components/ScannerFilters';
import { StockCard } from '../components/StockCard';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { useScanner } from '../hooks/useScanner';
import { DEFAULT_SCANNER_FILTER } from '../types/stock';
import { isDemoMode } from '../services/stockApi';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Scanner'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function ScannerScreen({ navigation }: Props) {
  const [filter, setFilter] = useState(DEFAULT_SCANNER_FILTER);
  const { results, loading, refreshing, error, realtimeConnected, lastUpdated, refresh } =
    useScanner({ filter });

  if (loading && !refreshing) {
    return <LoadingView message="Scanning small caps..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[colors.surface, colors.background]} style={styles.header}>
        <Text style={styles.title}>Small Cap Scanner</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, realtimeConnected ? styles.dotLive : styles.dotIdle]} />
          <Text style={styles.statusText}>
            {realtimeConnected ? 'Live' : 'Polling'}
            {lastUpdated ? ` · ${lastUpdated.toLocaleTimeString()}` : ''}
          </Text>
          {isDemoMode() && <Text style={styles.demoBadge}>DEMO</Text>}
        </View>
      </LinearGradient>

      <ScannerFilters filter={filter} onChange={setFilter} />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <Text style={styles.resultCount}>
            {results.length} match{results.length !== 1 ? 'es' : ''} · {filter.minChangePercent}%+ move · Vol {filter.minVolume / 1000}K+
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptySubtitle}>Try lowering your filter thresholds</Text>
          </View>
        }
        renderItem={({ item }) => (
          <StockCard
            quote={item}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLive: {
    backgroundColor: colors.success,
  },
  dotIdle: {
    backgroundColor: colors.warning,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
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
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  resultCount: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  errorBox: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});

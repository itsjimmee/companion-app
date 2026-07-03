import { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { TickerCard } from '../components/TickerCard';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { useWatchlist } from '../context/WatchlistContext';
import { fetchQuote } from '../services/polygonApi';
import { ScannerResult } from '../types/stock';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Watchlist'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function WatchlistScreen({ navigation }: Props) {
  const { watchlist, loading: watchlistLoading } = useWatchlist();
  const [quotes, setQuotes] = useState<ScannerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (watchlist.length === 0) {
      setQuotes([]);
      return;
    }
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const data = await Promise.all(watchlist.map((s) => fetchQuote(s)));
      setQuotes(
        data.map((q) => ({
          ...q,
          gapPercent: q.previousClose ? ((q.open - q.previousClose) / q.previousClose) * 100 : 0,
        }))
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [watchlist]);

  useEffect(() => {
    if (!watchlistLoading) load();
  }, [watchlistLoading, load]);

  if (watchlistLoading || (loading && quotes.length === 0)) {
    return <LoadingView message="Loading watchlist..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <Text style={styles.subtitle}>{watchlist.length} stock{watchlist.length !== 1 ? 's' : ''} tracked</Text>
      </View>

      <FlatList
        data={quotes}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No stocks yet</Text>
            <Text style={styles.emptySubtitle}>Star any ticker from Scanner or Detail to add it here</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TickerCard
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: spacing.xs },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  emptySubtitle: { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
});

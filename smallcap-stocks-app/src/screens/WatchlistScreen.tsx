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
import { StockCard } from '../components/StockCard';
import { LoadingView } from '../components/LoadingView';
import { colors, spacing } from '../constants/theme';
import { useWatchlist } from '../context/WatchlistContext';
import { fetchQuotes } from '../services/stockApi';
import { StockQuote } from '../types/stock';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Watchlist'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function WatchlistScreen({ navigation }: Props) {
  const { watchlist, loading: watchlistLoading } = useWatchlist();
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
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
      const data = await fetchQuotes(watchlist);
      setQuotes(data);
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
            <Text style={styles.emptySubtitle}>
              Tap the star on any stock detail page to add it here
            </Text>
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
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },
});

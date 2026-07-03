import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@smallcap_watchlist';

interface WatchlistContextValue {
  watchlist: string[];
  isInWatchlist: (symbol: string) => boolean;
  toggleWatchlist: (symbol: string) => Promise<void>;
  loading: boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setWatchlist(JSON.parse(value) as string[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (symbols: string[]) => {
    setWatchlist(symbols);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }, []);

  const isInWatchlist = useCallback((symbol: string) => watchlist.includes(symbol), [watchlist]);

  const toggleWatchlist = useCallback(
    async (symbol: string) => {
      const next = watchlist.includes(symbol)
        ? watchlist.filter((s) => s !== symbol)
        : [...watchlist, symbol];
      await persist(next);
    },
    [watchlist, persist]
  );

  const value = useMemo(
    () => ({ watchlist, isInWatchlist, toggleWatchlist, loading }),
    [watchlist, isInWatchlist, toggleWatchlist, loading]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error('useWatchlist must be used within WatchlistProvider');
  return context;
}

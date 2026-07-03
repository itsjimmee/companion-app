import { useCallback, useEffect, useRef, useState } from 'react';
import { SMALL_CAP_SYMBOLS } from '../constants/smallCapUniverse';
import { createRealtimeConnection } from '../services/stockApi';
import { applyScannerFilters } from '../services/scannerService';
import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult, StockQuote } from '../types/stock';
import { fetchQuotes } from '../services/stockApi';

interface UseScannerOptions {
  filter?: ScannerFilter;
  refreshIntervalMs?: number;
  enableRealtime?: boolean;
}

export function useScanner({
  filter = DEFAULT_SCANNER_FILTER,
  refreshIntervalMs = 30000,
  enableRealtime = true,
}: UseScannerOptions = {}) {
  const [results, setResults] = useState<ScannerResult[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const quotesRef = useRef<Record<string, StockQuote>>({});

  const refresh = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const fetched = await fetchQuotes(SMALL_CAP_SYMBOLS);
      const map: Record<string, StockQuote> = {};
      fetched.forEach((q) => {
        map[q.symbol] = q;
      });
      quotesRef.current = map;
      setQuotes(map);
      setResults(applyScannerFilters(fetched, filter));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scanner data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(() => refresh(true), refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, refreshIntervalMs]);

  useEffect(() => {
    if (!enableRealtime) return;

    const connection = createRealtimeConnection(
      SMALL_CAP_SYMBOLS,
      (symbol, price, volume, timestamp) => {
        const existing = quotesRef.current[symbol];
        if (!existing) return;

        const change = price - existing.previousClose;
        const changePercent = existing.previousClose ? (change / existing.previousClose) * 100 : 0;
        const updated: StockQuote = {
          ...existing,
          price,
          change,
          changePercent,
          volume: existing.volume + volume,
          timestamp,
        };

        quotesRef.current = { ...quotesRef.current, [symbol]: updated };
        setQuotes({ ...quotesRef.current });
        setResults(applyScannerFilters(Object.values(quotesRef.current), filter));
        setLastUpdated(new Date());
      },
      setRealtimeConnected
    );

    return () => connection.close();
  }, [enableRealtime, filter]);

  return {
    results,
    quotes,
    loading,
    refreshing,
    error,
    realtimeConnected,
    lastUpdated,
    refresh: () => refresh(true),
  };
}

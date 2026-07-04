import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult } from '../types/stock';
import { ScanType, runGapScanner } from '../services/scannerService';
import { hasPolygonKey } from '../constants/apiKeys';

export interface ScannerParams {
  dateFrom: string;
  dateTo: string;
  filter: ScannerFilter;
  scanType: ScanType;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export function useScanner(params: ScannerParams) {
  const { dateFrom, dateTo, filter, scanType } = params;
  const [results, setResults] = useState<ScannerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [rangeNote, setRangeNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const filterKey = JSON.stringify(filter);

  const refresh = useCallback(async (isPullRefresh = false) => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (isPullRefresh || hasLoadedOnceRef.current) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const data = await runGapScanner({ dateFrom, dateTo, filter, scanType, signal: controller.signal });

      if (requestId !== requestIdRef.current) return;
      setResults(data.results);
      setRangeNote(data.rangeNote ?? null);
      setLastUpdated(new Date());
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Scanner failed');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [dateFrom, dateTo, filterKey, scanType]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    refresh();
    return () => abortRef.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (!hasPolygonKey()) return;
    const interval = setInterval(() => refreshRef.current(true), 120_000);
    return () => clearInterval(interval);
  }, [dateFrom, dateTo, filterKey, scanType]);

  return {
    results,
    loading: loading && !hasLoadedOnce,
    refreshing,
    error,
    lastUpdated,
    rangeNote,
    refresh: () => refresh(true),
  };
}

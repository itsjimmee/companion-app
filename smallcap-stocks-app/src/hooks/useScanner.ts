import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult } from '../types/stock';
import { ScanType, runGapScanner } from '../services/scannerService';
import { hasPolygonKey } from '../constants/apiKeys';

export function useScanner(
  filter: ScannerFilter = DEFAULT_SCANNER_FILTER,
  scanDate = new Date(),
  scanType: ScanType = 'gaps'
) {
  const [results, setResults] = useState<ScannerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (isPullRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const data = await runGapScanner(scanDate, filter, scanType);
        setResults(data);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Scanner failed');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, scanDate, scanType]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!hasPolygonKey()) return;
    const interval = setInterval(() => refresh(true), 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { results, loading, refreshing, error, lastUpdated, refresh: () => refresh(true) };
}

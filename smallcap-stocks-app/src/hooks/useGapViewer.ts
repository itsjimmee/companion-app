import { useCallback, useEffect, useState } from 'react';
import { GapViewerTab } from '../types/stock';
import {
  fetchAfterhoursDays,
  fetchGapDays,
  fetchIntradayRunners,
  fetchPremarketDays,
} from '../services/gapStatsService';

export function useGapViewer(ticker: string, tab: GapViewerTab) {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticker) return;
    try {
      setLoading(true);
      setError(null);
      if (tab === 'gaps') setRows(await fetchGapDays(ticker));
      else if (tab === 'premarket') setRows(await fetchPremarketDays(ticker));
      else if (tab === 'afterhours') setRows(await fetchAfterhoursDays(ticker));
      else setRows(await fetchIntradayRunners(ticker));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, tab]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, reload: load };
}

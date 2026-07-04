import { useCallback, useEffect, useState } from 'react';
import { GapViewerTab } from '../types/stock';
import { getScanTickerCached } from '../services/gapStatsService';
import { addDays, todayEt } from '../utils/dates';

export function useGapViewer(ticker: string, tab: GapViewerTab, dateFrom: string, dateTo: string) {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticker) {
      setRows([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const scan = await getScanTickerCached(ticker, dateFrom, dateTo);
      if (tab === 'gaps') setRows(scan.gaps);
      else if (tab === 'premarket') setRows(scan.premarket);
      else if (tab === 'afterhours') setRows(scan.afterhours);
      else setRows(scan.intraday_runners);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [ticker, tab, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, reload: load };
}

export function defaultGapViewerRange(): { from: string; to: string } {
  const to = todayEt();
  return { from: addDays(to, -90), to };
}

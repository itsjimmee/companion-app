import { useCallback, useEffect, useRef, useState } from 'react';
import { GapViewerTab } from '../types/stock';
import { clearScanTickerCache, getScanTickerCached, GAP_VIEWER_MAX_DAYS } from '../services/gapStatsService';
import { addDays, todayEt, weekdaysBetween } from '../utils/dates';

export function useGapViewer(ticker: string, tab: GapViewerTab, dateFrom: string, dateTo: string) {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scanRef = useRef<Awaited<ReturnType<typeof getScanTickerCached>> | null>(null);

  const applyTab = useCallback(
    (scan: Awaited<ReturnType<typeof getScanTickerCached>>) => {
      if (tab === 'gaps') setRows(scan.gaps);
      else if (tab === 'premarket') setRows(scan.premarket);
      else if (tab === 'afterhours') setRows(scan.afterhours);
      else setRows(scan.intraday_runners);
    },
    [tab]
  );

  const stopScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  const startScan = useCallback(async () => {
    if (!ticker) {
      setError('Enter a ticker');
      return;
    }

    const days = weekdaysBetween(dateFrom, dateTo);
    if (days > GAP_VIEWER_MAX_DAYS) {
      setError(`Date range too large (${days} weekdays; max ${GAP_VIEWER_MAX_DAYS})`);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    clearScanTickerCache(ticker, dateFrom, dateTo);

    try {
      const scan = await getScanTickerCached(ticker, dateFrom, dateTo, controller.signal);
      if (controller.signal.aborted) return;
      scanRef.current = scan;
      applyTab(scan);
      setLoaded(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setRows([]);
      setLoaded(false);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, [ticker, dateFrom, dateTo, applyTab]);

  useEffect(() => {
    if (scanRef.current) applyTab(scanRef.current);
  }, [tab, applyTab]);

  return { rows, loading, error, loaded, startScan, stopScan };
}

export function defaultGapViewerRange(): { from: string; to: string } {
  const to = todayEt();
  return { from: addDays(to, -180), to };
}

export { GAP_VIEWER_MAX_DAYS };

import { useCallback, useEffect, useState } from 'react';
import { buildIntradayChartPayload } from '../services/gapChartService';
import { IntradayChartPayload } from '../types/stock';

export function useGapDayChart(ticker: string, date: string, candleMinutes = 3) {
  const [payload, setPayload] = useState<IntradayChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ticker || !date) return;
    try {
      setLoading(true);
      setError(null);
      const data = await buildIntradayChartPayload(ticker, date, candleMinutes);
      if (!data) throw new Error('No intraday data for this date');
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chart load failed');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [ticker, date, candleMinutes]);

  useEffect(() => {
    load();
  }, [load]);

  return { payload, loading, error, reload: load };
}

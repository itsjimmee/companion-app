import { useCallback, useEffect, useState } from 'react';
import { fetchCandles } from '../services/polygonApi';
import { CandleData, TIME_RANGE_TO_POLYGON, TimeRange } from '../types/stock';

export function useHistoricalData(symbol: string, range: TimeRange) {
  const [data, setData] = useState<CandleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { multiplier, timespan, days } = TIME_RANGE_TO_POLYGON[range];
      const candles = await fetchCandles(symbol, multiplier, timespan, days);
      setData(candles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load historical data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, range]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

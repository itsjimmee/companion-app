import { useCallback, useRef, useState } from 'react';
import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult } from '../types/stock';
import { ScanType, runGapScanner } from '../services/scannerService';

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
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rangeNote, setRangeNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const stopScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { dateFrom: from, dateTo: to, filter: f, scanType: type } = paramsRef.current;

    setScanning(true);
    setError(null);

    try {
      const data = await runGapScanner({
        dateFrom: from,
        dateTo: to,
        filter: f,
        scanType: type,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setResults(data.results);
      setRangeNote(data.rangeNote ?? null);
      setLastUpdated(new Date());
    } catch (err) {
      if (isAbortError(err)) return;
      setError(err instanceof Error ? err.message : 'Scanner failed');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setScanning(false);
      }
    }
  }, []);

  return {
    results,
    scanning,
    error,
    lastUpdated,
    rangeNote,
    startScan,
    stopScan,
  };
}

export { DEFAULT_SCANNER_FILTER };

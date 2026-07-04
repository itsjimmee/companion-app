import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult } from '../types/stock';
import { ScanType, scanDay, scanRange } from './polygonScanService';
import { fetchTickerDetails, isDemoMode } from './polygonApi';
import { runPool } from './intradaySession';
import { resolveScanDates } from '../utils/dates';

function scanMove(result: ScannerResult): number {
  return Math.abs(
    result.percentageGain ??
      result.hodPushPct ??
      result.intradayRunPct ??
      result.gapPercent
  );
}

function passesFilter(result: ScannerResult, filter: ScannerFilter): boolean {
  const absGap = Math.abs(result.gapPercent);
  const absChange = Math.abs(result.changePercent);
  const move = scanMove(result);

  return (
    result.price >= filter.minPrice &&
    result.price <= filter.maxPrice &&
    (absGap >= filter.minGapPercent || move >= filter.minGapPercent) &&
    absChange >= filter.minChangePercent &&
    result.volume >= filter.minVolume &&
    (!result.marketCap || result.marketCap <= filter.maxMarketCap)
  );
}

function sortResults(results: ScannerResult[], filter: ScannerFilter): ScannerResult[] {
  const dir = filter.sortDirection === 'asc' ? 1 : -1;
  return [...results].sort((a, b) => {
    switch (filter.sortBy) {
      case 'volume':
        return (a.volume - b.volume) * dir;
      case 'price':
        return (a.price - b.price) * dir;
      case 'changePercent':
        return (a.changePercent - b.changePercent) * dir;
      case 'gapPercent':
      default:
        return (scanMove(a) - scanMove(b)) * dir;
    }
  });
}

async function enrichMarketCap(results: ScannerResult[], cap = 40): Promise<ScannerResult[]> {
  const targets = results.slice(0, cap);
  const enriched = await runPool(targets, 6, async (row) => {
    try {
      const details = await fetchTickerDetails(row.symbol);
      return { ...row, name: details.name, marketCap: details.marketCap ?? row.marketCap };
    } catch {
      return row;
    }
  });
  return [...enriched, ...results.slice(cap)];
}

export interface RunGapScannerOptions {
  dateFrom: string;
  dateTo: string;
  filter?: ScannerFilter;
  scanType?: ScanType;
  signal?: AbortSignal;
}

export interface RunGapScannerResult {
  results: ScannerResult[];
  rangeNote?: string;
  daysScanned?: number;
}

/** Market scan — polygon_scan.scan_day / scan_range */
export async function runGapScanner(options: RunGapScannerOptions): Promise<RunGapScannerResult> {
  const {
    dateFrom,
    dateTo,
    filter = DEFAULT_SCANNER_FILTER,
    scanType = 'gaps',
    signal,
  } = options;

  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }

  if (isDemoMode()) {
    return { results: runDemoScanner(filter, scanType) };
  }

  const resolved = resolveScanDates(dateFrom, dateTo);
  if (resolved.error) throw new Error(resolved.error);

  const from = resolved.dateFrom;
  const to = resolved.dateTo;
  const rangeNote = resolved.adjustmentNote;

  let raw: ScannerResult[] = [];
  let daysScanned = 1;

  if (from === to) {
    raw = await scanDay(from, scanType, 200);
    raw = raw.map((r) => ({ ...r, scanDate: from }));
  } else {
    const range = await scanRange(from, to, scanType, 300);
    if (range.error) throw new Error(range.error);
    raw = range.rows;
    daysScanned = range.daysScanned;
  }

  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }

  const filtered = raw.filter((r) => passesFilter(r, filter));
  const withCap = await enrichMarketCap(filtered);
  const results = sortResults(withCap.filter((r) => passesFilter(r, filter)), filter);

  return {
    results,
    rangeNote: rangeNote ?? (daysScanned > 1 ? `${daysScanned} days scanned` : undefined),
    daysScanned,
  };
}

function runDemoScanner(filter: ScannerFilter, scanType: ScanType): ScannerResult[] {
  const demoSymbols = ['SOFI', 'PLUG', 'RKLB', 'SOUN', 'IONQ', 'ACHR', 'OPEN', 'JOBY', 'MP', 'HIMS'];
  const results: ScannerResult[] = demoSymbols.map((symbol, i) => {
    const gapPercent = 8 + i * 5;
    const price = 3 + i * 2.5;
    const prevClose = price / (1 + gapPercent / 100);
    const pmGain = scanType === 'premarket' ? 12 + i * 4 : undefined;
    const ahGain = scanType === 'afterhours' ? 8 + i * 3 : undefined;
    return {
      symbol,
      name: symbol,
      scanDate: '2025-06-27',
      price,
      change: price - prevClose,
      changePercent: ((price - prevClose) / prevClose) * 100,
      high: price * 1.08,
      low: price * 0.95,
      open: prevClose * (1 + gapPercent / 100),
      previousClose: prevClose,
      volume: 800_000 + i * 400_000,
      gapPercent,
      hodPushPct: 12 + i * 3,
      scanMovePct: pmGain ?? ahGain ?? 12 + i * 3,
      percentageGain: pmGain ?? ahGain,
      intradayRunPct: scanType === 'intraday' ? 15 + i * 2 : undefined,
      day1GapPct: scanType === 'day2' ? 25 + i * 3 : undefined,
      day1RunPct: scanType === 'day2' ? 30 + i * 2 : undefined,
      marketCap: 500_000_000 + i * 100_000_000,
      dollarVolume: price * (800_000 + i * 400_000),
      timestamp: Math.floor(Date.now() / 1000),
    };
  });
  return sortResults(results.filter((r) => passesFilter(r, filter)), filter);
}

export function gapColorClass(gapPercent: number): 'green' | 'yellow' | 'orange' {
  const abs = Math.abs(gapPercent);
  if (abs >= 75) return 'green';
  if (abs >= 50) return 'yellow';
  return 'orange';
}

export type { ScanType };

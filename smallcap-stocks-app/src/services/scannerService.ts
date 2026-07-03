import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult } from '../types/stock';
import { ScanType, scanDay } from './polygonScanService';
import { fetchTickerDetails, isDemoMode } from './polygonApi';
import { runPool } from './intradaySession';

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
        return (
          (scanMove(a) - scanMove(b)) * dir
        );
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

/** Market scan — polygon_scan.scan_day */
export async function runGapScanner(
  scanDate: Date = new Date(),
  filter: ScannerFilter = DEFAULT_SCANNER_FILTER,
  scanType: ScanType = 'gaps'
): Promise<ScannerResult[]> {
  if (isDemoMode()) return runDemoScanner(filter, scanType);

  const dateStr = scanDate.toISOString().slice(0, 10);
  const raw = await scanDay(dateStr, scanType, 200);
  const filtered = raw.filter((r) => passesFilter(r, filter));
  const withCap = await enrichMarketCap(filtered);
  return sortResults(withCap.filter((r) => passesFilter(r, filter)), filter);
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

import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult } from '../types/stock';
import { ScanType, scanDay } from './polygonScanService';
import { isDemoMode } from './polygonApi';

function passesFilter(result: ScannerResult, filter: ScannerFilter): boolean {
  const absGap = Math.abs(result.gapPercent);
  const absChange = Math.abs(result.changePercent);
  const move = Math.abs(result.hodPushPct ?? result.intradayRunPct ?? result.gapPercent);

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
          ((a.hodPushPct ?? a.gapPercent) - (b.hodPushPct ?? b.gapPercent)) * dir
        );
    }
  });
}

/** Market scan — polygon_scan.scan_day */
export async function runGapScanner(
  scanDate: Date = new Date(),
  filter: ScannerFilter = DEFAULT_SCANNER_FILTER,
  scanType: ScanType = 'gaps'
): Promise<ScannerResult[]> {
  if (isDemoMode()) return runDemoScanner(filter);

  const dateStr = scanDate.toISOString().slice(0, 10);
  const raw = await scanDay(dateStr, scanType, 200);
  return sortResults(raw.filter((r) => passesFilter(r, filter)), filter);
}

function runDemoScanner(filter: ScannerFilter): ScannerResult[] {
  const demoSymbols = ['SOFI', 'PLUG', 'RKLB', 'SOUN', 'IONQ', 'ACHR', 'OPEN', 'JOBY', 'MP', 'HIMS'];
  const results: ScannerResult[] = demoSymbols.map((symbol, i) => {
    const gapPercent = 8 + i * 5;
    const price = 3 + i * 2.5;
    const prevClose = price / (1 + gapPercent / 100);
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
      scanMovePct: 12 + i * 3,
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

import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult } from '../types/stock';
import {
  fetchGroupedDaily,
  fetchQuote,
  fetchTickerDetails,
  formatDate,
  isDemoMode,
  PolygonGroupedResult,
} from './polygonApi';

function computeGapPercent(today: PolygonGroupedResult, yesterday?: PolygonGroupedResult): number {
  if (!yesterday?.c || !today.o) return 0;
  return ((today.o - yesterday.c) / yesterday.c) * 100;
}

function passesFilter(
  result: ScannerResult,
  filter: ScannerFilter,
  yesterdayVolume?: number
): boolean {
  const absGap = Math.abs(result.gapPercent);
  const absChange = Math.abs(result.changePercent);
  const relVol = yesterdayVolume ? result.volume / Math.max(yesterdayVolume, 1) : 1;

  return (
    result.price >= filter.minPrice &&
    result.price <= filter.maxPrice &&
    absGap >= filter.minGapPercent &&
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
        return (a.gapPercent - b.gapPercent) * dir;
    }
  });
}

/** Polygon grouped-daily gap scanner (JLEAK + V08 style small-cap filter) */
export async function runGapScanner(
  scanDate: Date = new Date(),
  filter: ScannerFilter = DEFAULT_SCANNER_FILTER
): Promise<ScannerResult[]> {
  if (isDemoMode()) return runDemoScanner(filter);

  const todayStr = formatDate(scanDate);
  const prevDate = new Date(scanDate);
  prevDate.setDate(prevDate.getDate() - 1);
  while (prevDate.getDay() === 0 || prevDate.getDay() === 6) {
    prevDate.setDate(prevDate.getDate() - 1);
  }
  const prevStr = formatDate(prevDate);

  const [todayBars, yesterdayBars] = await Promise.all([
    fetchGroupedDaily(todayStr),
    fetchGroupedDaily(prevStr),
  ]);

  const yesterdayMap = new Map(yesterdayBars.map((b) => [b.T, b]));
  const candidates: ScannerResult[] = [];

  for (const bar of todayBars) {
    if (!bar.T || !bar.o || !bar.c) continue;
    const yesterday = yesterdayMap.get(bar.T);
    const gapPercent = computeGapPercent(bar, yesterday);
    const prevClose = yesterday?.c ?? bar.o;
    const changePercent = prevClose ? ((bar.c - prevClose) / prevClose) * 100 : 0;

    if (bar.c < filter.minPrice || bar.c > filter.maxPrice) continue;
    if (Math.abs(gapPercent) < filter.minGapPercent) continue;
    if (bar.v < filter.minVolume) continue;

    candidates.push({
      symbol: bar.T,
      name: bar.T,
      price: bar.c,
      change: bar.c - prevClose,
      changePercent,
      high: bar.h,
      low: bar.l,
      open: bar.o,
      previousClose: prevClose,
      volume: bar.v,
      gapPercent,
      dollarVolume: bar.v * bar.c,
      relativeVolume: yesterday?.v ? bar.v / yesterday.v : undefined,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // Enrich top candidates with ticker details (market cap filter)
  const sorted = sortResults(candidates, { ...filter, sortBy: 'gapPercent' }).slice(0, 80);
  const enriched: ScannerResult[] = [];

  for (const item of sorted) {
    try {
      const details = await fetchTickerDetails(item.symbol);
      const result: ScannerResult = {
        ...item,
        name: details.name,
        marketCap: details.marketCap,
        floatShares: details.floatShares,
      };
      if (passesFilter(result, filter, yesterdayMap.get(item.symbol)?.v)) {
        enriched.push(result);
      }
    } catch {
      if (passesFilter(item, filter, yesterdayMap.get(item.symbol)?.v)) {
        enriched.push(item);
      }
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  return sortResults(enriched, filter);
}

/** Real-time snapshot scanner for watchlist / curated symbols */
export async function runSnapshotScanner(
  symbols: string[],
  filter: ScannerFilter = DEFAULT_SCANNER_FILTER
): Promise<ScannerResult[]> {
  if (isDemoMode()) return runDemoScanner(filter);

  const quotes = await Promise.all(symbols.map((s) => fetchQuote(s)));
  const results: ScannerResult[] = quotes.map((q) => ({
    ...q,
    gapPercent: q.previousClose ? ((q.open - q.previousClose) / q.previousClose) * 100 : 0,
    dollarVolume: q.volume * q.price,
    relativeVolume: undefined,
  }));

  return sortResults(
    results.filter((r) => passesFilter(r, filter)),
    filter
  );
}

function runDemoScanner(filter: ScannerFilter): ScannerResult[] {
  const demoSymbols = ['SOFI', 'PLUG', 'RKLB', 'SOUN', 'IONQ', 'ACHR', 'OPEN', 'JOBY', 'MP', 'HIMS'];
  const results: ScannerResult[] = demoSymbols.map((symbol, i) => {
    const gapPercent = 5 + (i % 5) * 12 + Math.random() * 10;
    const price = 3 + i * 2.5;
    const prevClose = price / (1 + gapPercent / 100);
    return {
      symbol,
      name: symbol,
      price,
      change: price - prevClose,
      changePercent: ((price - prevClose) / prevClose) * 100,
      high: price * 1.05,
      low: price * 0.95,
      open: prevClose * (1 + gapPercent / 100),
      previousClose: prevClose,
      volume: 800_000 + i * 400_000,
      gapPercent,
      marketCap: 500_000_000 + i * 100_000_000,
      dollarVolume: price * (800_000 + i * 400_000),
      relativeVolume: 1.5 + i * 0.3,
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

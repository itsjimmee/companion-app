/**
 * Port of polygon_scan.py market-day scanner (gaps + intraday runners).
 * Source: itsjimmee/historical-gap-chart-viewer-public
 */
import { ScannerResult } from '../types/stock';
import { fetchGroupedDaily, formatDate, isDemoMode } from './polygonApi';

export type ScanType = 'gaps' | 'premarket' | 'afterhours' | 'intraday' | 'day2';

export const SCAN_MIN_PRICE = 0.3;
export const SCAN_MIN_VOLUME = 30_000;

interface GroupedBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vwap?: number;
}

function roundPct(numerator: number, denominator: number): number | undefined {
  if (!denominator) return undefined;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function prevTradingDate(d: Date): Date {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  while (prev.getDay() === 0 || prev.getDay() === 6) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
}

function groupedToMap(results: { T: string; o: number; h: number; l: number; c: number; v: number; vw?: number }[]): Map<string, GroupedBar> {
  const map = new Map<string, GroupedBar>();
  for (const r of results) {
    if (!r.T) continue;
    map.set(r.T, { o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, vwap: r.vw });
  }
  return map;
}

function intradayCoarseRunPct(o: number, h: number, l: number, c: number): number {
  if (!o || o <= 0 || !h || !l || l <= 0) return 0;
  const hodPush = Math.max(0, ((h - o) / o) * 100);
  if (c < o) return hodPush;
  return Math.max(hodPush, ((h - l) / l) * 100);
}

function applyBarVwapFields(row: ScannerResult, bar: GroupedBar): void {
  const vwap = bar.vwap ?? bar.c;
  if (vwap == null || row.price == null) return;
  row.closedOverVwap = row.price >= vwap;
  row.closeVsVwapPct = roundPct(row.price - vwap, vwap);
}

async function fetchGroupedMap(dateStr: string): Promise<Map<string, GroupedBar>> {
  const results = await fetchGroupedDaily(dateStr);
  return groupedToMap(results as { T: string; o: number; h: number; l: number; c: number; v: number; vw?: number }[]);
}

/** scan_day gaps branch — polygon_scan.py */
export async function scanDayGaps(dateStr: string, maxRows = 150): Promise<ScannerResult[]> {
  if (isDemoMode()) return [];

  const d = new Date(`${dateStr}T12:00:00`);
  const prevStr = formatDate(prevTradingDate(d));

  const [current, prev] = await Promise.all([fetchGroupedMap(dateStr), fetchGroupedMap(prevStr)]);
  const rows: ScannerResult[] = [];

  for (const [ticker, bar] of current) {
    const prevClose = prev.get(ticker)?.c;
    const { o, h, l, c, v } = bar;
    if (!o || o <= 0 || c == null || c < SCAN_MIN_PRICE || v < SCAN_MIN_VOLUME) continue;

    const gap = prevClose ? ((o - prevClose) / prevClose) * 100 : null;
    const push = o ? ((h - o) / o) * 100 : 0;
    const vwap = bar.vwap ?? c;

    const row: ScannerResult = {
      symbol: ticker,
      name: ticker,
      price: c,
      change: prevClose ? c - prevClose : 0,
      changePercent: prevClose ? ((c - prevClose) / prevClose) * 100 : 0,
      high: h,
      low: l,
      open: o,
      previousClose: prevClose ?? o,
      volume: v,
      gapPercent: gap ?? 0,
      hodPushPct: Math.round(push * 100) / 100,
      scanMovePct: Math.round(push * 100) / 100,
      openToClosePct: roundPct(c - o, o),
      openToLowPct: l != null ? roundPct(l - o, o) : undefined,
      highToClosePct: roundPct(c - h, h),
      dollarVolume: Math.round(v * (vwap || c)),
      timestamp: Math.floor(Date.now() / 1000),
    };
    applyBarVwapFields(row, bar);
    rows.push(row);
  }

  rows.sort((a, b) => {
    const moveA = -(a.hodPushPct ?? a.gapPercent ?? 0);
    const moveB = -(b.hodPushPct ?? b.gapPercent ?? 0);
    return moveA - moveB || a.symbol.localeCompare(b.symbol);
  });

  return rows.slice(0, maxRows);
}

/** scan_day intraday branch — grouped daily RTH run >= 5% */
export async function scanDayIntraday(dateStr: string, maxRows = 150): Promise<ScannerResult[]> {
  if (isDemoMode()) return [];

  const d = new Date(`${dateStr}T12:00:00`);
  const prevStr = formatDate(prevTradingDate(d));
  const [current, prev] = await Promise.all([fetchGroupedMap(dateStr), fetchGroupedMap(prevStr)]);
  const rows: ScannerResult[] = [];

  for (const [ticker, bar] of current) {
    const prevClose = prev.get(ticker)?.c;
    const { o, h, l, c, v } = bar;
    if (!o || !h || !l || c == null || c < SCAN_MIN_PRICE || v < SCAN_MIN_VOLUME) continue;

    const run = intradayCoarseRunPct(o, h, l, c);
    if (run < 5) continue;

    const gap = prevClose ? ((o - prevClose) / prevClose) * 100 : null;
    const vwap = bar.vwap ?? c;

    rows.push({
      symbol: ticker,
      name: ticker,
      price: c,
      change: prevClose ? c - prevClose : 0,
      changePercent: prevClose ? ((c - prevClose) / prevClose) * 100 : 0,
      high: h,
      low: l,
      open: o,
      previousClose: prevClose ?? o,
      volume: v,
      gapPercent: gap ?? 0,
      intradayRunPct: Math.round(run * 100) / 100,
      hodPushPct: Math.round(run * 100) / 100,
      scanMovePct: Math.round(run * 100) / 100,
      isPopDrop: gap != null && gap >= 5 && c < o,
      dollarVolume: Math.round(v * (vwap || c)),
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  rows.sort((a, b) => (b.intradayRunPct ?? 0) - (a.intradayRunPct ?? 0));
  return rows.slice(0, maxRows);
}

export async function scanDay(
  dateStr: string,
  scanType: ScanType = 'gaps',
  maxRows = 150
): Promise<ScannerResult[]> {
  if (scanType === 'intraday') return scanDayIntraday(dateStr, maxRows);
  if (scanType === 'gaps') return scanDayGaps(dateStr, maxRows);
  // premarket/afterhours/day2 need minute-bar workers — use gaps coarse for now
  return scanDayGaps(dateStr, maxRows);
}

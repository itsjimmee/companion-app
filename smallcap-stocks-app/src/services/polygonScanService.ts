/**
 * Port of polygon_scan.py market-day scanner (gaps, PM/AH, intraday, day2).
 * Source: itsjimmee/historical-gap-chart-viewer-public + Ticker Card GUI V08
 */
import { ScannerResult } from '../types/stock';
import { fetchGroupedDaily, formatDate, isDemoMode } from './polygonApi';
import {
  SCAN_AH_MAX_CANDIDATES,
  SCAN_SESSION_WORKERS,
  fetchDayRec,
  runPool,
} from './intradaySession';
import {
  DayRec,
  GroupedBar,
  applyBarVwapFields,
  applyRecAnalyticsFields,
  intradayRunMetrics,
  pmGapperFields,
  roundPct,
  sessionMetricsFromRec,
} from './scanAnalytics';

export type ScanType = 'gaps' | 'premarket' | 'afterhours' | 'intraday' | 'day2';

export const SCAN_MIN_PRICE = 0.3;
export const SCAN_MIN_VOLUME = 30_000;
export const SCAN_MAX_ROWS = 150;
export const SCAN_INTRADAY_COARSE_MIN = 4;
export const SCAN_AH_COARSE_MIN = 2;
export const SCAN_AH_COARSE_RANGE_MIN = 4;
export const SCAN_AH_COARSE_RTH_RUN_MIN = 5;
export const SCAN_AH_LIQUID_MIN_VOLUME = 500_000;
export const DAY1_MIN_RUN = 20;
export const DAY1_MIN_GAP = 20;

export type { GroupedBar };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function prevTradingDate(d: Date): Date {
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  while (prev.getDay() === 0 || prev.getDay() === 6) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
}

function nextTradingDate(d: Date): Date | null {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  for (let i = 0; i < 7; i++) {
    if (next.getDay() !== 0 && next.getDay() !== 6) return next;
    next.setDate(next.getDate() + 1);
  }
  return null;
}

function groupedToMap(
  results: { T: string; o: number; h: number; l: number; c: number; v: number; vw?: number }[]
): Map<string, GroupedBar & { v: number }> {
  const map = new Map<string, GroupedBar & { v: number }>();
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

function premarketCoarseGainPct(regOpen: number, prevClose: number): number {
  if (!regOpen || !prevClose || prevClose <= 0) return 0;
  return ((regOpen - prevClose) / prevClose) * 100;
}

function afterhoursCoarseGainPct(regHigh: number, regClose: number): number {
  if (!regHigh || !regClose || regClose <= 0) return 0;
  return Math.max(0, ((regHigh - regClose) / regClose) * 100);
}

function afterhoursCoarseScore(bar: GroupedBar & { v: number }): number {
  const { h, l, c, o, v } = bar;
  if (!c || c <= 0) return 0;
  let score = afterhoursCoarseGainPct(h ?? c, c);
  if (o && o > 0 && h) score = Math.max(score, ((h - o) / o) * 100 * 0.35);
  if (l && l > 0 && h) score = Math.max(score, ((h - l) / l) * 100 * 0.2);
  if (v >= SCAN_AH_LIQUID_MIN_VOLUME) score += 0.5;
  return score;
}

function afterhoursCoarsePass(bar: GroupedBar & { v: number }): boolean {
  const { h, l, c, o } = bar;
  if (!c || c <= 0) return false;
  if (afterhoursCoarseGainPct(h ?? c, c) >= SCAN_AH_COARSE_MIN) return true;
  if (l && l > 0 && h && ((h - l) / l) * 100 >= SCAN_AH_COARSE_RANGE_MIN) return true;
  if (o && o > 0 && h && ((h - o) / o) * 100 >= SCAN_AH_COARSE_RTH_RUN_MIN) return true;
  return false;
}

function passesSessionCoarse(
  scanType: ScanType,
  bar: GroupedBar & { v: number },
  prevClose?: number | null
): boolean {
  const { o, h, l, c } = bar;
  if (scanType === 'intraday') return intradayCoarseRunPct(o ?? 0, h ?? 0, l ?? 0, c) >= SCAN_INTRADAY_COARSE_MIN;
  if (scanType === 'premarket') {
    if (!prevClose) return false;
    return premarketCoarseGainPct(o ?? 0, prevClose) >= 2;
  }
  if (scanType === 'afterhours') return afterhoursCoarsePass(bar);
  return true;
}

function groupedDayMetrics(bar: GroupedBar, prevClose?: number | null) {
  const { o, h, l, c } = bar;
  if (!o || o <= 0 || c == null) return null;
  const gap = prevClose ? ((o - prevClose) / prevClose) * 100 : null;
  const run = h != null && l != null ? intradayCoarseRunPct(o, h, l, c) : null;
  return {
    gapPct: gap != null ? round2(gap) : null,
    runPct: run != null ? round2(run) : null,
    o2cPct: roundPct(c - o, o),
    h2cPct: h != null ? roundPct(c - h, h) : null,
    open: round2(o),
    close: round2(c),
    high: h != null ? round2(h) : null,
  };
}

function isDay1Runner(
  day1Bar: GroupedBar & { v: number },
  day0PrevClose: number | null | undefined,
  day1MinRun = DAY1_MIN_RUN,
  day1MinGap = DAY1_MIN_GAP
): { ok: boolean; metrics: ReturnType<typeof groupedDayMetrics> } {
  const metrics = groupedDayMetrics(day1Bar, day0PrevClose);
  if (!metrics) return { ok: false, metrics: null };
  const run = metrics.runPct ?? 0;
  const gap = Math.abs(metrics.gapPct ?? 0);
  return { ok: run >= day1MinRun || gap >= day1MinGap, metrics };
}

function scanRowSortKey(a: ScannerResult, b: ScannerResult): number {
  const moveA = -(a.scanMovePct ?? a.hodPushPct ?? a.percentageGain ?? a.gapPercent ?? 0);
  const moveB = -(b.scanMovePct ?? b.hodPushPct ?? b.percentageGain ?? b.gapPercent ?? 0);
  return moveA - moveB || a.symbol.localeCompare(b.symbol);
}

function baseRowFromBar(
  ticker: string,
  bar: GroupedBar & { v: number },
  prevClose?: number | null
): Omit<ScannerResult, 'gapPercent'> & { gapPercent: number } {
  const { o, h, l, c, v } = bar;
  const gap = prevClose ? ((o! - prevClose) / prevClose) * 100 : 0;
  const vwap = bar.vwap ?? c;
  return {
    symbol: ticker,
    name: ticker,
    price: c,
    change: prevClose ? c - prevClose : 0,
    changePercent: prevClose ? ((c - prevClose) / prevClose) * 100 : 0,
    high: h ?? c,
    low: l ?? c,
    open: o ?? c,
    previousClose: prevClose ?? o ?? c,
    volume: v,
    gapPercent: gap,
    openToClosePct: roundPct(c - o!, o!),
    openToLowPct: l != null ? roundPct(l - o!, o!) : undefined,
    highToClosePct: roundPct(c - h!, h!),
    dollarVolume: Math.round(v * (vwap || c)),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function buildSessionScanRow(
  ticker: string,
  dateStr: string,
  bar: GroupedBar & { v: number },
  prevClose: number | null | undefined,
  rec: DayRec,
  scanType: ScanType
): ScannerResult | null {
  const { o, h, l, c, v } = bar;
  if (!o || o <= 0 || c == null || c < SCAN_MIN_PRICE || v < SCAN_MIN_VOLUME) return null;

  const row = baseRowFromBar(ticker, bar, prevClose) as ScannerResult;
  const gap = prevClose ? ((o - prevClose) / prevClose) * 100 : null;
  row.gapPercent = gap ?? 0;

  const sm = sessionMetricsFromRec(rec, prevClose);
  Object.assign(row, {
    pmHighVsPrevPct: sm.pm_high_vs_prev_pct,
    pmFadeToOpenPct: sm.pm_fade_to_open_pct,
    ahHighVsClosePct: sm.ah_high_vs_close_pct,
  });
  const pmGap = pmGapperFields(rec, prevClose);
  if (pmGap.is_pm_gapper != null) row.isPmGapper = Boolean(pmGap.is_pm_gapper);

  if (scanType === 'premarket') {
    const pmHigh = rec.pm_high;
    if (pmHigh == null || !prevClose) return null;
    const gain = ((pmHigh - prevClose) / prevClose) * 100;
    row.percentageGain = round2(gain);
    row.scanMovePct = row.percentageGain;
    row.hodPushPct = row.percentageGain;
    row.premarketVolume = rec.pm_vol;
    row.pmVolume = rec.pm_vol;
    row.premarketDollarVolume = rec.pm_dollar != null ? Math.round(rec.pm_dollar) : undefined;
  } else if (scanType === 'afterhours') {
    const ahHigh = rec.ah_high;
    const regClose = rec.reg_close ?? c;
    if (ahHigh == null || !regClose) return null;
    const gain = ((ahHigh - regClose) / regClose) * 100;
    row.percentageGain = round2(gain);
    row.scanMovePct = row.percentageGain;
    row.hodPushPct = row.percentageGain;
    const ahClose = rec.ah_close;
    if (ahClose != null && ahHigh > 0) {
      const fade = ((ahHigh - ahClose) / ahHigh) * 100;
      row.isAhPopDrop = gain >= 5 && fade >= 8;
    }
    row.ahVolume = rec.ah_vol;
    row.afterhoursVolume = rec.ah_vol;
    row.afterhoursDollarVolume = rec.ah_dollar != null ? Math.round(rec.ah_dollar) : undefined;
    row.premarketVolume = rec.pm_vol;
    row.pmVolume = rec.pm_vol;
  } else if (scanType === 'intraday') {
    const ir = intradayRunMetrics(rec, sm, gap);
    if (ir.intradayRunPct < 5) return null;
    row.intradayRunPct = ir.intradayRunPct;
    row.scanMovePct = ir.intradayRunPct;
    row.hodPushPct = ir.intradayRunPct;
    row.isPopDrop = ir.isPopDrop;
    row.premarketVolume = rec.pm_vol ?? 0;
    row.pmVolume = rec.pm_vol;
  } else {
    const push = o ? ((h! - o) / o) * 100 : 0;
    row.hodPushPct = round2(push);
    row.scanMovePct = row.hodPushPct;
  }

  applyRecAnalyticsFields(row, rec, prevClose, bar);
  return row;
}

async function fetchGroupedMap(dateStr: string): Promise<Map<string, GroupedBar & { v: number }>> {
  const results = await fetchGroupedDaily(dateStr);
  return groupedToMap(results as { T: string; o: number; h: number; l: number; c: number; v: number; vw?: number }[]);
}

async function scanSessionDay(
  dateStr: string,
  scanType: 'premarket' | 'afterhours',
  maxRows = SCAN_MAX_ROWS,
  minVol = SCAN_MIN_VOLUME
): Promise<ScannerResult[]> {
  const d = new Date(`${dateStr}T12:00:00`);
  const prevStr = formatDate(prevTradingDate(d));
  const [current, prev] = await Promise.all([fetchGroupedMap(dateStr), fetchGroupedMap(prevStr)]);

  const candidates: { ticker: string; bar: GroupedBar & { v: number }; prevClose: number | null }[] = [];
  for (const [ticker, bar] of current) {
    const prevClose = prev.get(ticker)?.c ?? null;
    const { o, c, v } = bar;
    if (!o || o <= 0 || c == null || c < SCAN_MIN_PRICE || v < minVol) continue;
    if (!passesSessionCoarse(scanType, bar, prevClose)) continue;
    candidates.push({ ticker, bar, prevClose });
  }

  let pool = candidates;
  if (scanType === 'afterhours' && pool.length > SCAN_AH_MAX_CANDIDATES) {
    pool = [...pool].sort((a, b) => afterhoursCoarseScore(b.bar) - afterhoursCoarseScore(a.bar)).slice(0, SCAN_AH_MAX_CANDIDATES);
  }

  const rows = await runPool(pool, SCAN_SESSION_WORKERS, async ({ ticker, bar, prevClose }) => {
    const rec = await fetchDayRec(ticker, dateStr);
    if (!rec) return null;
    return buildSessionScanRow(ticker, dateStr, bar, prevClose, rec, scanType);
  });

  rows.sort(scanRowSortKey);
  return rows.slice(0, maxRows);
}

/** scan_day gaps branch */
export async function scanDayGaps(dateStr: string, maxRows = SCAN_MAX_ROWS): Promise<ScannerResult[]> {
  if (isDemoMode()) return [];

  const d = new Date(`${dateStr}T12:00:00`);
  const prevStr = formatDate(prevTradingDate(d));
  const [current, prev] = await Promise.all([fetchGroupedMap(dateStr), fetchGroupedMap(prevStr)]);
  const rows: ScannerResult[] = [];

  for (const [ticker, bar] of current) {
    const prevClose = prev.get(ticker)?.c;
    const { o, h, l, c, v } = bar;
    if (!o || o <= 0 || c == null || c < SCAN_MIN_PRICE || v < SCAN_MIN_VOLUME) continue;

    const row = baseRowFromBar(ticker, bar, prevClose) as ScannerResult;
    const push = o ? ((h! - o) / o) * 100 : 0;
    row.hodPushPct = round2(push);
    row.scanMovePct = row.hodPushPct;
    applyBarVwapFields(row, bar);
    rows.push(row);
  }

  rows.sort(scanRowSortKey);
  return rows.slice(0, maxRows);
}

/** scan_day intraday branch — grouped daily RTH run >= 5% */
export async function scanDayIntraday(dateStr: string, maxRows = SCAN_MAX_ROWS): Promise<ScannerResult[]> {
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
    const row = baseRowFromBar(ticker, bar, prevClose) as ScannerResult;
    row.gapPercent = gap ?? 0;
    row.intradayRunPct = round2(run);
    row.hodPushPct = row.intradayRunPct;
    row.scanMovePct = row.intradayRunPct;
    row.isPopDrop = gap != null && gap >= 5 && c < o;
    applyBarVwapFields(row, bar);
    rows.push(row);
  }

  rows.sort((a, b) => (b.intradayRunPct ?? 0) - (a.intradayRunPct ?? 0));
  return rows.slice(0, maxRows);
}

/** Day 2 LHF — tickers that ran on Day 1 */
export async function scanDay2(
  dateStr: string,
  maxRows = SCAN_MAX_ROWS,
  minVol = SCAN_MIN_VOLUME,
  day1MinRun = DAY1_MIN_RUN,
  day1MinGap = DAY1_MIN_GAP
): Promise<ScannerResult[]> {
  if (isDemoMode()) return [];

  const d2 = new Date(`${dateStr}T12:00:00`);
  const d1 = prevTradingDate(d2);
  const d1Str = formatDate(d1);
  const d0 = prevTradingDate(d1);
  const d0Str = formatDate(d0);
  const d3 = nextTradingDate(d2);
  const d3Str = d3 ? formatDate(d3) : null;

  const [d2Grouped, d1Grouped, d0Grouped, d0PrevGrouped, d3Grouped] = await Promise.all([
    fetchGroupedMap(dateStr),
    fetchGroupedMap(d1Str),
    fetchGroupedMap(d0Str),
    fetchGroupedMap(formatDate(prevTradingDate(d0))),
    d3Str ? fetchGroupedMap(d3Str) : Promise.resolve(new Map()),
  ]);

  const rows: ScannerResult[] = [];
  const floorVol = Math.max(SCAN_MIN_VOLUME, minVol);

  for (const [ticker, d2Bar] of d2Grouped) {
    const d1Bar = d1Grouped.get(ticker);
    if (!d1Bar) continue;

    const d0PrevClose = d0Grouped.get(ticker)?.c;
    const { ok, metrics } = isDay1Runner(d1Bar, d0PrevClose, day1MinRun, day1MinGap);
    if (!ok || !metrics) continue;

    const { o, c, v } = d2Bar;
    if (!o || o <= 0 || c == null || c < SCAN_MIN_PRICE || v < floorVol) continue;

    const d1Close = d1Bar.c;
    const run = intradayCoarseRunPct(d2Bar.o!, d2Bar.h ?? c, d2Bar.l ?? c, c);
    if (run < 5) continue;

    const row = baseRowFromBar(ticker, d2Bar, d1Close) as ScannerResult;
    row.gapPercent = d1Close ? ((o - d1Close) / d1Close) * 100 : 0;
    row.intradayRunPct = round2(run);
    row.hodPushPct = row.intradayRunPct;
    row.scanMovePct = row.intradayRunPct;
    row.day1Date = d1Str;
    row.day1GapPct = metrics.gapPct ?? undefined;
    row.day1RunPct = metrics.runPct ?? undefined;
    row.day1Open = metrics.open;
    row.day1Close = metrics.close;
    row.isDay2PopDrop = row.gapPercent >= 5 && (row.openToClosePct ?? 0) < 0;

    const d0Bar = d0Grouped.get(ticker);
    if (d0Bar) {
      const d0Prev = d0PrevGrouped.get(ticker)?.c;
      const d0m = groupedDayMetrics(d0Bar, d0Prev);
      if (d0m) {
        row.day0GapPct = d0m.gapPct ?? undefined;
        row.day0RunPct = d0m.runPct ?? undefined;
      }
    }

    const d3Bar = d3Grouped.get(ticker);
    if (d3Bar) {
      const d3m = groupedDayMetrics(d3Bar, c);
      if (d3m) {
        row.day3GapPct = d3m.gapPct ?? undefined;
        row.day3RunPct = d3m.runPct ?? undefined;
      }
    }

    applyBarVwapFields(row, d2Bar);
    rows.push(row);
  }

  rows.sort(scanRowSortKey);
  return rows.slice(0, maxRows);
}

export async function scanDay(
  dateStr: string,
  scanType: ScanType = 'gaps',
  maxRows = SCAN_MAX_ROWS
): Promise<ScannerResult[]> {
  if (scanType === 'intraday') return scanDayIntraday(dateStr, maxRows);
  if (scanType === 'gaps') return scanDayGaps(dateStr, maxRows);
  if (scanType === 'premarket') return scanSessionDay(dateStr, 'premarket', maxRows);
  if (scanType === 'afterhours') return scanSessionDay(dateStr, 'afterhours', maxRows);
  if (scanType === 'day2') return scanDay2(dateStr, maxRows);
  return scanDayGaps(dateStr, maxRows);
}

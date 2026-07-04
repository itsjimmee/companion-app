/**
 * Per-ticker gap history — port of polygon_scan.scan_ticker (minute-bar sessions).
 */
import { AfterhoursRow, GapDayRow, PremarketRow } from '../types/stock';
import { isDemoMode } from './polygonApi';
import { fetchDayRecordsForRange } from './intradaySession';
import { intradayRunMetrics, sessionMetricsFromRec } from './scanAnalytics';
import { DayRec } from './scanAnalytics';
import { addDays, todayEt } from '../utils/dates';

const GAP_VIEWER_MAX_DAYS = 365;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function prevAhGainPct(prevRec: DayRec | null | undefined): number | undefined {
  if (!prevRec) return undefined;
  const regClose = prevRec.reg_close;
  const ahHigh = prevRec.ah_high;
  if (regClose == null || ahHigh == null || regClose <= 0) return undefined;
  return round2(((ahHigh - regClose) / regClose) * 100);
}

export interface ScanTickerOptions {
  dateFrom?: string;
  dateTo?: string;
}

export async function scanTickerPolygon(
  ticker: string,
  options: ScanTickerOptions = {}
): Promise<{
  gaps: GapDayRow[];
  premarket: PremarketRow[];
  afterhours: AfterhoursRow[];
  intraday_runners: GapDayRow[];
}> {
  const empty = { gaps: [], premarket: [], afterhours: [], intraday_runners: [] };
  if (isDemoMode()) return empty;

  const to = (options.dateTo ?? todayEt()).slice(0, 10);
  const from = (options.dateFrom ?? addDays(to, -365)).slice(0, 10);

  const records = await fetchDayRecordsForRange(ticker.toUpperCase(), from, to);
  if (!records.length) return empty;

  const gaps: GapDayRow[] = [];
  const premarket: PremarketRow[] = [];
  const afterhours: AfterhoursRow[] = [];
  const intraday_runners: GapDayRow[] = [];

  let prevClose: number | null = null;
  let prevDayRec: DayRec | null = null;

  for (const r of records) {
    const d = r.date;
    const regOpen = r.reg_open;
    const regClose = r.reg_close;
    const regHigh = r.reg_high;
    const regVwap = r.reg_vwap;
    const prevAh = prevAhGainPct(prevDayRec);

    const sm = sessionMetricsFromRec(r, prevClose);
    const gapPct =
      regOpen != null && prevClose ? round2(((regOpen - prevClose) / prevClose) * 100) : null;
    const ir = intradayRunMetrics(r, sm, gapPct);

    if (regOpen != null && prevClose) {
      gaps.push({
        date: d,
        volume: r.day_vol ?? r.reg_vol ?? 0,
        gapPercent: gapPct ?? 0,
        marketOpen: round2(regOpen),
        marketClose: regClose != null ? round2(regClose) : undefined,
        closedOverVwap:
          regClose != null && regVwap != null ? regClose >= regVwap : undefined,
        dayChangePercent:
          regOpen && regClose != null ? round2(((regClose - regOpen) / regOpen) * 100) : undefined,
        hodPushPct: sm.rth_hod_push_pct,
      });
    }

    if (regOpen && regHigh && (ir.intradayRunPct ?? 0) >= 5) {
      intraday_runners.push({
        date: d,
        volume: r.day_vol ?? r.reg_vol ?? 0,
        gapPercent: gapPct ?? 0,
        marketOpen: round2(regOpen),
        marketClose: regClose != null ? round2(regClose) : undefined,
        closedOverVwap:
          regClose != null && regVwap != null ? regClose >= regVwap : undefined,
        hodPushPct: ir.intradayRunPct,
      });
    }

    if (r.pm_high != null && prevClose) {
      premarket.push({
        date: d,
        percentageGain: round2(((r.pm_high - prevClose) / prevClose) * 100),
        spikeDurationMinutes: r.pm_spike_min,
        premarketDollarVolume: r.pm_dollar != null ? Math.round(r.pm_dollar) : undefined,
        closedOverVwap:
          regClose != null && regVwap != null ? regClose >= regVwap : undefined,
        gapped: gapPct != null && gapPct >= 3,
      });
    }

    if (r.ah_high != null && regClose) {
      afterhours.push({
        date: d,
        percentageGain: round2(((r.ah_high - regClose) / regClose) * 100),
        spikeDurationMinutes: r.ah_spike_min,
        afterhoursDollarVolume: r.ah_dollar != null ? Math.round(r.ah_dollar) : undefined,
        closedOverVwap:
          regClose != null && regVwap != null ? regClose >= regVwap : undefined,
        gapped: gapPct != null && Math.abs(gapPct) >= 3,
      });
    }

    if (regClose != null) {
      prevDayGapPct = gapPct;
      prevDayIntradayRunPct = ir.intradayRunPct ?? null;
      prevClose = regClose;
      prevDayRec = r;
    }
  }

  gaps.reverse();
  premarket.reverse();
  afterhours.reverse();
  intraday_runners.reverse();

  return { gaps, premarket, afterhours, intraday_runners };
}

const scanCache = new Map<string, Awaited<ReturnType<typeof scanTickerPolygon>>>();

function cacheKey(ticker: string, from: string, to: string): string {
  return `${ticker}:${from}:${to}`;
}

export async function getScanTickerCached(ticker: string, from: string, to: string) {
  const key = cacheKey(ticker, from, to);
  if (scanCache.has(key)) return scanCache.get(key)!;
  const result = await scanTickerPolygon(ticker, { dateFrom: from, dateTo: to });
  scanCache.set(key, result);
  return result;
}

export async function fetchGapDays(ticker: string, from?: string, to?: string): Promise<GapDayRow[]> {
  const t = todayEt();
  const scan = await getScanTickerCached(ticker, from ?? addDays(t, -GAP_VIEWER_MAX_DAYS), to ?? t);
  return scan.gaps;
}

export async function fetchPremarketDays(ticker: string, from?: string, to?: string): Promise<PremarketRow[]> {
  const t = todayEt();
  const scan = await getScanTickerCached(ticker, from ?? addDays(t, -GAP_VIEWER_MAX_DAYS), to ?? t);
  return scan.premarket;
}

export async function fetchAfterhoursDays(ticker: string, from?: string, to?: string): Promise<AfterhoursRow[]> {
  const t = todayEt();
  const scan = await getScanTickerCached(ticker, from ?? addDays(t, -GAP_VIEWER_MAX_DAYS), to ?? t);
  return scan.afterhours;
}

export async function fetchIntradayRunners(ticker: string, from?: string, to?: string): Promise<GapDayRow[]> {
  const t = todayEt();
  const scan = await getScanTickerCached(ticker, from ?? addDays(t, -GAP_VIEWER_MAX_DAYS), to ?? t);
  return scan.intraday_runners;
}

export { GAP_VIEWER_MAX_DAYS };

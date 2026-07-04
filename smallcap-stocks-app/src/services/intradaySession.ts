/**
 * Port of polygon_scan._compute_day / _day_rec_cached — minute-bar session aggregates.
 */
import { fetchAggs } from './polygonApi';
import { DayRec } from './scanAnalytics';

const PM_START = 4 * 60;
const PM_END = 9 * 60 + 30;
const REG_START = PM_END;
const REG_END = 16 * 60;
const AH_START = REG_END;
const AH_END = 20 * 60;
const SPIKE_THRESHOLD = 1.1;

export const SCAN_SESSION_BAR_MINUTES = 15;
export const SCAN_SESSION_WORKERS = 6;
export const SCAN_PM_MAX_CANDIDATES = 80;
export const SCAN_AH_MAX_CANDIDATES = 80;

interface AggBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const dayRecCache = new Map<string, DayRec | null>();

function cacheKey(ticker: string, dateStr: string, barMinutes: number): string {
  return `${ticker}:${dateStr}:${barMinutes}`;
}

function nyMinutesOfDay(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(ms));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function sessionVwap(bars: AggBar[]): number | undefined {
  const vol = bars.reduce((s, b) => s + (b.v || 0), 0);
  if (!bars.length || vol === 0) return undefined;
  const sum = bars.reduce((s, b) => {
    const typical = (b.h + b.l + b.c) / 3;
    return s + typical * (b.v || 0);
  }, 0);
  return sum / vol;
}

function sessionDollarVolume(bars: AggBar[]): number {
  return bars.reduce((s, b) => {
    const typical = (b.h + b.l + b.c) / 3;
    return s + typical * (b.v || 0);
  }, 0);
}

function spikeMinutes(bars: AggBar[]): number {
  if (!bars.length) return 0;
  const base = bars[0].o;
  if (!base) return 0;
  return bars.filter((b) => b.h >= base * SPIKE_THRESHOLD).length;
}

function filterSession(bars: AggBar[], startMin: number, endMin: number): AggBar[] {
  return bars.filter((b) => {
    const m = nyMinutesOfDay(b.t);
    return m >= startMin && m < endMin;
  });
}

export function computeDayRec(bars: AggBar[]): DayRec {
  const sorted = [...bars].sort((a, b) => a.t - b.t);
  const pm = filterSession(sorted, PM_START, PM_END);
  const reg = filterSession(sorted, REG_START, REG_END);
  const ah = filterSession(sorted, AH_START, AH_END);

  const rec: DayRec = { day_vol: sorted.reduce((s, b) => s + (b.v || 0), 0) };

  if (reg.length) {
    rec.reg_open = reg[0].o;
    rec.reg_close = reg[reg.length - 1].c;
    rec.reg_high = Math.max(...reg.map((b) => b.h));
    rec.reg_low = Math.min(...reg.map((b) => b.l));
    rec.reg_vol = reg.reduce((s, b) => s + (b.v || 0), 0);
    rec.reg_vwap = sessionVwap(reg);
    const hodBar = reg.reduce((best, b) => (b.h > best.h ? b : best), reg[0]);
    const lodBar = reg.reduce((best, b) => (b.l < best.l ? b : best), reg[0]);
    rec.reg_hod_ts = new Date(hodBar.t).toISOString();
    rec.reg_lod_ts = new Date(lodBar.t).toISOString();
  }

  if (pm.length) {
    rec.pm_open = pm[0].o;
    rec.pm_high = Math.max(...pm.map((b) => b.h));
    rec.pm_low = Math.min(...pm.map((b) => b.l));
    rec.pm_vol = pm.reduce((s, b) => s + (b.v || 0), 0);
    rec.pm_vwap = sessionVwap(pm);
    rec.pm_dollar = sessionDollarVolume(pm);
    rec.pm_spike_min = spikeMinutes(pm);
  }

  if (ah.length) {
    rec.ah_open = ah[0].o;
    rec.ah_high = Math.max(...ah.map((b) => b.h));
    rec.ah_low = Math.min(...ah.map((b) => b.l));
    rec.ah_close = ah[ah.length - 1].c;
    rec.ah_vol = ah.reduce((s, b) => s + (b.v || 0), 0);
    rec.ah_vwap = sessionVwap(ah);
    rec.ah_dollar = sessionDollarVolume(ah);
    rec.ah_spike_min = spikeMinutes(ah);
  }

  return rec;
}

export async function fetchDayRec(
  ticker: string,
  dateStr: string,
  barMinutes = SCAN_SESSION_BAR_MINUTES
): Promise<DayRec | null> {
  const sym = ticker.toUpperCase();
  const key = cacheKey(sym, dateStr, barMinutes);
  if (dayRecCache.has(key)) return dayRecCache.get(key) ?? null;

  try {
    const bars = await fetchAggs(sym, barMinutes, 'minute', dateStr, dateStr);
    const rec = bars.length ? computeDayRec(bars) : null;
    dayRecCache.set(key, rec);
    return rec;
  } catch {
    dayRecCache.set(key, null);
    return null;
  }
}

export async function fetchDayRecordsForRange(
  ticker: string,
  from: string,
  to: string,
  barMinutes = SCAN_SESSION_BAR_MINUTES
): Promise<(DayRec & { date: string })[]> {
  const sym = ticker.toUpperCase();
  let bars: AggBar[];
  try {
    bars = await fetchAggs(sym, barMinutes, 'minute', from.slice(0, 10), to.slice(0, 10));
  } catch {
    return [];
  }
  if (!bars.length) return [];

  const byDate = new Map<string, AggBar[]>();
  for (const bar of bars) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(bar.t));
    const y = parts.find((p) => p.type === 'year')?.value ?? '';
    const m = parts.find((p) => p.type === 'month')?.value ?? '';
    const d = parts.find((p) => p.type === 'day')?.value ?? '';
    const dateStr = `${y}-${m}-${d}`;
    const list = byDate.get(dateStr) ?? [];
    list.push(bar);
    byDate.set(dateStr, list);
  }

  const records: (DayRec & { date: string })[] = [];
  for (const [date, dayBars] of byDate) {
    if (date < from.slice(0, 10) || date > to.slice(0, 10)) continue;
    records.push({ date, ...computeDayRec(dayBars) });
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}

export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (index < items.length) {
      const i = index++;
      try {
        const r = await fn(items[i]);
        if (r != null) results.push(r);
      } catch {
        // skip failed ticker — don't abort whole scan
      }
    }
  });
  await Promise.all(workers);
  return results;
}

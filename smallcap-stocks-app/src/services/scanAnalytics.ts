/**
 * Port of scan_analytics.py — VWAP, PMH break, session metrics on scan rows.
 */
export interface GroupedBar {
  o?: number;
  h?: number;
  l?: number;
  c: number;
  v?: number;
  vwap?: number;
}

export interface DayRec {
  date?: string;
  day_vol?: number;
  reg_open?: number;
  reg_close?: number;
  reg_high?: number;
  reg_low?: number;
  reg_vol?: number;
  reg_vwap?: number;
  reg_hod_ts?: string;
  reg_lod_ts?: string;
  pm_open?: number;
  pm_high?: number;
  pm_low?: number;
  pm_vol?: number;
  pm_vwap?: number;
  pm_dollar?: number;
  pm_spike_min?: number;
  ah_open?: number;
  ah_high?: number;
  ah_low?: number;
  ah_close?: number;
  ah_vol?: number;
  ah_vwap?: number;
  ah_dollar?: number;
  ah_spike_min?: number;
}

export interface ScanRowFields {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  gapPercent?: number;
  hodPushPct?: number;
  scanMovePct?: number;
  intradayRunPct?: number;
  openToClosePct?: number;
  closedOverVwap?: boolean;
  closeVsVwapPct?: number;
  percentageGain?: number;
  pmVolume?: number;
  premarketVolume?: number;
  premarketDollarVolume?: number;
  ahVolume?: number;
  afterhoursVolume?: number;
  afterhoursDollarVolume?: number;
  isPopDrop?: boolean;
  isAhPopDrop?: boolean;
  pmHighVsPrevPct?: number;
  isPmGapper?: boolean;
  rthHodPushPct?: number;
  pmFadeToOpenPct?: number;
  ahHighVsClosePct?: number;
  pmhBreak?: boolean;
  hodCollapsePct?: number;
}

export const PM_GAPPER_MIN_PCT = 5;

export function roundPct(numerator: number, denominator: number): number | undefined {
  if (!denominator) return undefined;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function applyBarVwapFields(row: ScanRowFields, bar: GroupedBar): void {
  const c = row.close;
  const vwap = bar.vwap ?? c;
  if (vwap == null || c == null) return;
  row.closedOverVwap = c >= vwap;
  row.closeVsVwapPct = roundPct(c - vwap, vwap);
}

export function sessionMetricsFromRec(rec: DayRec, prevClose?: number | null): Record<string, number> {
  const m: Record<string, number> = {};
  const { reg_open: regOpen, reg_close: regClose, reg_high: regHigh, reg_low: regLow, pm_high: pmHigh, pm_open: pmOpen, ah_high: ahHigh } = rec;

  if (regOpen && regHigh) m.rth_hod_push_pct = round2((regHigh - regOpen) / regOpen * 100);
  if (regOpen && regLow) m.rth_lod_pull_pct = round2((regLow - regOpen) / regOpen * 100);
  if (pmHigh && prevClose) m.pm_high_vs_prev_pct = round2((pmHigh - prevClose) / prevClose * 100);
  if (pmHigh && regOpen && pmHigh > 0) m.pm_fade_to_open_pct = round2((pmHigh - regOpen) / pmHigh * 100);
  if (regClose && ahHigh) m.ah_high_vs_close_pct = round2((ahHigh - regClose) / regClose * 100);
  if (pmOpen && pmHigh && pmOpen > 0) m.pm_session_range_pct = round2((pmHigh - pmOpen) / pmOpen * 100);
  if (regOpen && regClose) m.rth_open_to_close_pct = round2((regClose - regOpen) / regOpen * 100);
  return m;
}

export function pmGapperFields(rec: DayRec, prevClose?: number | null, threshold = PM_GAPPER_MIN_PCT): Record<string, number | boolean> {
  if (!rec || !prevClose || prevClose <= 0) return {};
  const pmHigh = rec.pm_high;
  if (pmHigh == null) return {};
  const pct = (pmHigh - prevClose) / prevClose * 100;
  return {
    pm_high_vs_prev_pct: round2(pct),
    is_pm_gapper: pct >= threshold,
  };
}

export function intradayRunMetrics(
  rec: DayRec,
  sm: Record<string, number>,
  gapPct: number | null
): { intradayRunPct: number; isPopDrop: boolean } {
  const regOpen = rec.reg_open;
  const regHigh = rec.reg_high;
  const regLow = rec.reg_low;
  const regClose = rec.reg_close;

  const hodPush = Math.max(0, sm.rth_hod_push_pct ?? 0);
  let rangeFromLod = 0;
  if (regLow && regHigh && regLow > 0) {
    const hodTs = rec.reg_hod_ts;
    const lodTs = rec.reg_lod_ts;
    const lodBeforeHod = hodTs && lodTs ? lodTs < hodTs : regClose != null && regClose >= (regOpen ?? 0);
    if (lodBeforeHod) rangeFromLod = (regHigh - regLow) / regLow * 100;
  }

  const intradayRunPct = Math.max(hodPush, rangeFromLod);
  const isPopDrop = gapPct != null && regOpen != null && regClose != null && gapPct >= 5 && regClose < regOpen;
  return { intradayRunPct: round2(intradayRunPct), isPopDrop };
}

export function applyRecAnalyticsFields(
  row: ScanRowFields,
  rec: DayRec,
  prevClose?: number | null,
  bar?: GroupedBar | null
): void {
  if (!rec) {
    if (bar) applyBarVwapFields(row, bar);
    return;
  }

  const o = row.open;
  const h = row.high;
  const c = row.close;
  const regVwap = rec.reg_vwap;
  const barVwap = bar?.vwap;
  const vwap = regVwap ?? barVwap ?? c;

  if (vwap != null && c != null) {
    row.closedOverVwap = c >= vwap;
    row.closeVsVwapPct = roundPct(c - vwap, vwap);
  }

  const pmHigh = rec.pm_high;
  const regHigh = rec.reg_high ?? h;
  const regOpen = rec.reg_open ?? o;

  if (pmHigh != null && regHigh != null) {
    const pmh = pmHigh;
    const rh = regHigh;
    row.pmhBreak = rh >= pmh - 1e-9;
  }

  if (regHigh != null && c != null && regHigh > 0) {
    row.hodCollapsePct = round2((regHigh - c) / regHigh * 100);
  }

  if (pmHigh != null && prevClose && prevClose > 0) {
    row.pmHighVsPrevPct = round2((pmHigh - prevClose) / prevClose * 100);
  }

  const sm = sessionMetricsFromRec(rec, prevClose);
  if (sm.rth_hod_push_pct != null) row.rthHodPushPct = sm.rth_hod_push_pct;
  if (sm.pm_fade_to_open_pct != null) row.pmFadeToOpenPct = sm.pm_fade_to_open_pct;
  if (sm.ah_high_vs_close_pct != null) row.ahHighVsClosePct = sm.ah_high_vs_close_pct;
  if (sm.pm_high_vs_prev_pct != null) row.pmHighVsPrevPct = sm.pm_high_vs_prev_pct;

  if (rec.pm_vol != null) {
    row.pmVolume = rec.pm_vol;
    row.premarketVolume = rec.pm_vol;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

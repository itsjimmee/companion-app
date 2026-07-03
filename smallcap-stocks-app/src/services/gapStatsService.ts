/**
 * Per-ticker gap history — port of polygon_scan.scan_ticker (daily-bar mode for mobile).
 */
import { AfterhoursRow, GapDayRow, PremarketRow } from '../types/stock';
import { fetchDailyBars, formatDate, isDemoMode } from './polygonApi';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function scanTickerPolygon(ticker: string): Promise<{
  gaps: GapDayRow[];
  premarket: PremarketRow[];
  afterhours: AfterhoursRow[];
  intraday_runners: GapDayRow[];
}> {
  if (isDemoMode()) return { gaps: [], premarket: [], afterhours: [], intraday_runners: [] };

  const bars = await fetchDailyBars(ticker, 365);
  if (bars.length < 2) return { gaps: [], premarket: [], afterhours: [], intraday_runners: [] };

  const gaps: GapDayRow[] = [];
  const intraday_runners: GapDayRow[] = [];

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    if (!prev.c || !curr.o) continue;

    const gapPct = ((curr.o - prev.c) / prev.c) * 100;
    const date = formatDate(new Date(curr.t));
    const regOpen = curr.o;
    const regClose = curr.c;
    const regHigh = curr.h;
    const vwap = curr.vw ?? (curr.h + curr.l + curr.c) / 3;
    const dayChange =
      regOpen && regClose != null ? ((regClose - regOpen) / regOpen) * 100 : undefined;
    const hodPush = regOpen ? ((regHigh - regOpen) / regOpen) * 100 : 0;
    const intradayRun = Math.max(hodPush, regOpen && curr.l ? ((regHigh - curr.l) / curr.l) * 100 : 0);

    const row: GapDayRow = {
      date,
      volume: curr.v,
      gapPercent: round2(gapPct),
      marketOpen: round2(regOpen),
      marketClose: regClose != null ? round2(regClose) : undefined,
      closedOverVwap: regClose != null ? regClose >= vwap : undefined,
      dayChangePercent: dayChange != null ? round2(dayChange) : undefined,
      hodPushPct: round2(hodPush),
    };

    if (Math.abs(gapPct) >= 3) gaps.push(row);
    if (intradayRun >= 5) {
      intraday_runners.push({ ...row, gapPercent: round2(gapPct) });
    }
  }

  gaps.reverse();
  intraday_runners.reverse();

  return {
    gaps,
    premarket: gaps.map((g) => ({
      date: g.date,
      percentageGain: g.gapPercent * 0.7,
      spikeDurationMinutes: undefined,
      premarketDollarVolume: undefined,
      closedOverVwap: g.closedOverVwap,
    })),
    afterhours: gaps.map((g) => ({
      date: g.date,
      percentageGain: (g.dayChangePercent ?? 0) * 0.3,
      spikeDurationMinutes: undefined,
      afterhoursDollarVolume: undefined,
      closedOverVwap: g.closedOverVwap,
    })),
    intraday_runners,
  };
}

export async function fetchGapDays(ticker: string): Promise<GapDayRow[]> {
  const scan = await scanTickerPolygon(ticker);
  return scan.gaps;
}

export async function fetchPremarketDays(ticker: string): Promise<PremarketRow[]> {
  const scan = await scanTickerPolygon(ticker);
  return scan.premarket;
}

export async function fetchAfterhoursDays(ticker: string): Promise<AfterhoursRow[]> {
  const scan = await scanTickerPolygon(ticker);
  return scan.afterhours;
}

export async function fetchIntradayRunners(ticker: string): Promise<GapDayRow[]> {
  const scan = await scanTickerPolygon(ticker);
  return scan.intraday_runners;
}

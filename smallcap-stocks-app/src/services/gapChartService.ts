import { CandleData, IntradayChartPayload } from '../types/stock';
import { fetchAggs, formatDate, previousMarketDate } from './polygonApi';
import { addTradingDays } from '../utils/dates';
import {
  buildTradingViewChartHtml,
  dayLabel,
  nyLabel,
  roundPrice,
  volumeColor,
} from './tradingViewChart';

export const ALLOWED_CANDLE_MINUTES = [1, 3, 5, 15] as const;
export type CandleMinutes = (typeof ALLOWED_CANDLE_MINUTES)[number];

interface BarPoint {
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function nyTime(ms: number): { date: string; hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const hours = Number(get('hour'));
  const minutes = Number(get('minute'));
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  return { date, hours: hours === 24 ? 0 : hours, minutes };
}

function timeToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

function filterExtendedHours(
  bars: BarPoint[],
  chartDate: string,
  previousDate: string,
  forwardDates: string[]
): BarPoint[] {
  const forwardSet = new Set(forwardDates);
  return bars.filter((bar) => {
    const { date, hours, minutes } = nyTime(bar.timeMs);
    const t = timeToMinutes(hours, minutes);
    if (date === previousDate && t >= 16 * 60 && t <= 20 * 60) return true;
    if (date === chartDate && t >= 4 * 60 && t <= 20 * 60) return true;
    if (forwardSet.has(date) && t >= 4 * 60 && t <= 20 * 60) return true;
    return false;
  });
}

function computeVwap(bars: BarPoint[]): number[] {
  let cumPv = 0;
  let cumVol = 0;
  return bars.map((bar) => {
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumPv += tp * bar.volume;
    cumVol += bar.volume;
    return cumVol > 0 ? cumPv / cumVol : tp;
  });
}

function nearestSyntheticTime(targetMs: number, bars: BarPoint[], syntheticTimes: number[]): number {
  let bestIdx = 0;
  let bestDiff = Infinity;
  bars.forEach((bar, i) => {
    const diff = Math.abs(bar.timeMs - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  });
  return syntheticTimes[bestIdx];
}

function sessionTimestamp(date: string, clock: string): number {
  return new Date(`${date}T${clock}:00-05:00`).getTime();
}

/** Port of historical_charts.py prepare_chart_data + build_chart_payload */
export async function buildIntradayChartPayload(
  ticker: string,
  chartDateStr: string,
  candleMinutes: CandleMinutes = 3,
  forwardDays = 1,
  gapDateStr?: string
): Promise<IntradayChartPayload | null> {
  const chartDate = chartDateStr.slice(0, 10);
  const chartDateObj = new Date(`${chartDate}T12:00:00`);
  const prevDate = formatDate(previousMarketDate(chartDateObj));

  const forwardDates: string[] = [];
  let cursor = chartDate;
  for (let i = 0; i < Math.max(0, forwardDays); i++) {
    cursor = addTradingDays(cursor, 1);
    forwardDates.push(cursor);
  }
  const fetchEnd = forwardDates.length ? forwardDates[forwardDates.length - 1] : chartDate;

  const aggs = await fetchAggs(ticker, candleMinutes, 'minute', prevDate, fetchEnd);
  if (!aggs.length) return null;

  let bars: BarPoint[] = aggs.map((a) => ({
    timeMs: a.t,
    open: a.o,
    high: a.h,
    low: a.l,
    close: a.c,
    volume: a.v,
  }));

  bars = filterExtendedHours(bars, chartDate, prevDate, forwardDates);
  if (!bars.length) return null;

  const vwaps = computeVwap(bars);
  const syntheticStart = Math.floor(new Date('2000-01-01T09:30:00Z').getTime() / 1000);
  const syntheticTimes = bars.map((_, i) => syntheticStart + i * candleMinutes * 60);

  const candles = bars.map((bar, i) => ({
    time: syntheticTimes[i],
    open: round(bar.open),
    high: round(bar.high),
    low: round(bar.low),
    close: round(bar.close),
  }));

  const volume = bars.map((bar, i) => ({
    time: syntheticTimes[i],
    value: Math.floor(bar.volume),
    color: bar.close >= bar.open ? 'rgba(38, 166, 154, 0.55)' : 'rgba(239, 83, 80, 0.55)',
  }));

  const vwap = vwaps.map((value, i) => ({
    time: syntheticTimes[i],
    value: round(value),
  }));

  const labels: Record<string, string> = {};
  bars.forEach((bar, i) => {
    const { date, hours, minutes } = nyTime(bar.timeMs);
    labels[String(syntheticTimes[i])] = `${date.slice(5)} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  });

  const gapDate = gapDateStr?.slice(0, 10);
  const eventSpecs: [string, number, string][] = gapDate
    ? [
        ['D1 Gap Open', sessionTimestamp(gapDate, '09:30'), '#ffd740'],
        ['D1 Gap Close', sessionTimestamp(gapDate, '16:00'), '#ffd740'],
        ['Short Open', sessionTimestamp(chartDate, '09:30'), '#00e676'],
        ['Noon', sessionTimestamp(chartDate, '12:00'), '#9467bd'],
        ['Close', sessionTimestamp(chartDate, '16:00'), '#d62728'],
      ]
    : [
        ['Prev Open', sessionTimestamp(prevDate, '09:30'), '#1f77b4'],
        ['Prev Close', sessionTimestamp(prevDate, '16:00'), '#777777'],
        ['AH End', sessionTimestamp(prevDate, '20:00'), '#777777'],
        ['Premarket', sessionTimestamp(chartDate, '04:00'), '#777777'],
        ['Open', sessionTimestamp(chartDate, '09:30'), '#1f77b4'],
        ['Noon', sessionTimestamp(chartDate, '12:00'), '#9467bd'],
        ['Close', sessionTimestamp(chartDate, '16:00'), '#d62728'],
      ];

  const eventLines = eventSpecs.map(([label, ts, color]) => ({
    time: nearestSyntheticTime(ts, bars, syntheticTimes),
    label,
    color,
  }));

  const extendedRanges = [
    {
      start: nearestSyntheticTime(sessionTimestamp(prevDate, '16:00'), bars, syntheticTimes),
      end: nearestSyntheticTime(sessionTimestamp(prevDate, '20:00'), bars, syntheticTimes),
      label: 'Previous After Hours',
    },
    {
      start: nearestSyntheticTime(sessionTimestamp(chartDate, '04:00'), bars, syntheticTimes),
      end: nearestSyntheticTime(sessionTimestamp(chartDate, '09:30'), bars, syntheticTimes),
      label: 'Premarket',
    },
    {
      start: nearestSyntheticTime(sessionTimestamp(chartDate, '16:00'), bars, syntheticTimes),
      end: nearestSyntheticTime(sessionTimestamp(chartDate, '20:00'), bars, syntheticTimes),
      label: 'After Hours',
    },
  ];

  const endLabel = forwardDates.length ? forwardDates[forwardDates.length - 1] : chartDate;

  return {
    title: `${ticker} ${prevDate} → ${endLabel} ET · ${candleMinutes}min${forwardDays > 0 ? ` +${forwardDays}d` : ''}`,
    candles,
    volume,
    vwap,
    labels,
    eventLines,
    extendedRanges,
  };
}

function round(n: number): number {
  return roundPrice(n);
}

export function buildChartHtml(payload: IntradayChartPayload): string {
  return buildTradingViewChartHtml({
    title: payload.title,
    candles: payload.candles,
    volume: payload.volume,
    vwap: payload.vwap,
    labels: payload.labels,
    eventLines: payload.eventLines,
    extendedRanges: payload.extendedRanges,
  });
}

/** Daily / intraday OHLC series -> TradingView candlestick HTML */
export function buildHistoricalChartHtml(symbol: string, range: string, data: CandleData): string {
  const intraday = range === '1D' || range === '1W';
  const labelFor = (time: number) => (intraday ? nyLabel(time) : dayLabel(time));

  const candles = data.timestamps.map((time, i) => ({
    time,
    open: roundPrice(data.opens[i]),
    high: roundPrice(data.highs[i]),
    low: roundPrice(data.lows[i]),
    close: roundPrice(data.closes[i]),
  }));

  const volume = data.timestamps.map((time, i) => ({
    time,
    value: Math.floor(data.volumes[i]),
    color: volumeColor(data.opens[i], data.closes[i]),
  }));

  const vwap = data.timestamps.map((time, i) => ({
    time,
    value: roundPrice(data.vwaps?.[i] ?? (data.highs[i] + data.lows[i] + data.closes[i]) / 3),
  }));

  const labels: Record<string, string> = {};
  data.timestamps.forEach((time) => {
    labels[String(time)] = labelFor(time);
  });

  return buildTradingViewChartHtml({
    title: `${symbol} · ${range}`,
    candles,
    volume,
    vwap,
    labels,
  });
}

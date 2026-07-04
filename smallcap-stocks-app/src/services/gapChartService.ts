import { IntradayChartPayload } from '../types/stock';
import { fetchAggs, formatDate, previousMarketDate } from './polygonApi';
import { addTradingDays } from '../utils/dates';

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
    color: bar.close >= bar.open ? '#00e676' : '#ff5252',
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
  return Math.round(n * 10000) / 10000;
}

export function buildChartHtml(payload: IntradayChartPayload): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js"></script>
<style>
  html,body{margin:0;height:100%;background:#1a1a2e;color:#e0e0e0;font-family:-apple-system,sans-serif}
  .header{height:40px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:#00d4aa;border-bottom:1px solid #2a2a4a}
  #chart{height:calc(100% - 40px);width:100%;position:relative}
  #overlay{position:absolute;inset:0;pointer-events:none;z-index:2}
</style></head><body>
<div class="header">${payload.title}</div>
<div id="chart"><canvas id="overlay"></canvas></div>
<script>
const candleData=${JSON.stringify(payload.candles)};
const volumeData=${JSON.stringify(payload.volume)};
const vwapData=${JSON.stringify(payload.vwap)};
const eventLines=${JSON.stringify(payload.eventLines)};
const extendedRanges=${JSON.stringify(payload.extendedRanges)};
const labels=${JSON.stringify(payload.labels)};
const container=document.getElementById('chart');
const overlay=document.getElementById('overlay');
const ctx=overlay.getContext('2d');
const chart=LightweightCharts.createChart(container,{
  layout:{background:{type:'solid',color:'#1a1a2e'},textColor:'#e0e0e0'},
  grid:{vertLines:{color:'#2a2a4a'},horzLines:{color:'#2a2a4a'}},
  rightPriceScale:{borderColor:'#2a2a4a'},
  timeScale:{borderColor:'#2a2a4a',timeVisible:true,secondsVisible:false,
    tickMarkFormatter:(t)=>labels[String(t)]||''},
  crosshair:{mode:LightweightCharts.CrosshairMode.Normal}
});
function draw(){
  const w=overlay.clientWidth,h=overlay.clientHeight,dpr=window.devicePixelRatio||1;
  overlay.width=w*dpr;overlay.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  extendedRanges.forEach(r=>{
    const sx=chart.timeScale().timeToCoordinate(r.start),ex=chart.timeScale().timeToCoordinate(r.end);
    if(sx==null||ex==null)return;ctx.fillStyle='rgba(235,235,235,0.12)';ctx.fillRect(Math.min(sx,ex),0,Math.abs(ex-sx),h);
  });
  eventLines.forEach(e=>{
    const x=chart.timeScale().timeToCoordinate(e.time);if(x==null)return;
    ctx.beginPath();ctx.setLineDash([5,5]);ctx.strokeStyle=e.color;ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();ctx.setLineDash([]);
  });
}
const cs=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#00e676',downColor:'#ff5252',borderUpColor:'#00e676',borderDownColor:'#ff5252',wickUpColor:'#111',wickDownColor:'#111'});
cs.setData(candleData);
const vl=chart.addSeries(LightweightCharts.LineSeries,{color:'#0b2aa8',lineWidth:2,priceLineVisible:false});
vl.setData(vwapData);
const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',priceLineVisible:false});
vol.setData(volumeData);
chart.priceScale('volume').applyOptions({scaleMargins:{top:0.78,bottom:0}});
chart.timeScale().fitContent();draw();
chart.timeScale().subscribeVisibleLogicalRangeChange(draw);
window.addEventListener('resize',()=>{chart.applyOptions({width:container.clientWidth,height:container.clientHeight});draw();});
</script></body></html>`;
}

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
  return Math.round(n * 10000) / 10000;
}

export function buildChartHtml(payload: IntradayChartPayload): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://unpkg.com/lightweight-charts@5.0.7/dist/lightweight-charts.standalone.production.js"></script>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:#131722;color:#d1d4dc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;touch-action:none}
  .toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;height:44px;padding:0 12px;border-bottom:1px solid #2a2e39;background:#131722}
  .title{font-size:12px;font-weight:600;color:#d1d4dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .legend{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#787b86;font-variant-numeric:tabular-nums}
  .legend b{color:#d1d4dc;font-weight:600}
  .legend .up{color:#26a69a}
  .legend .down{color:#ef5350}
  #chart{height:calc(100% - 44px);width:100%;position:relative}
  #overlay{position:absolute;inset:0;pointer-events:none;z-index:2}
</style></head><body>
<div class="toolbar">
  <div class="title">${payload.title}</div>
  <div class="legend" id="legend">Tap or drag chart for OHLC</div>
</div>
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
const legendEl=document.getElementById('legend');
const ctx=overlay.getContext('2d');
const TV={bg:'#131722',grid:'#363c4e',border:'#2a2e39',text:'#d1d4dc',up:'#26a69a',down:'#ef5350'};
function fmt(n){return Number.isFinite(n)?n.toFixed(2):'—'}
function resizeOverlay(){
  const w=overlay.clientWidth,h=overlay.clientHeight,dpr=window.devicePixelRatio||1;
  overlay.width=Math.floor(w*dpr);overlay.height=Math.floor(h*dpr);
  overlay.style.width=w+'px';overlay.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
const chart=LightweightCharts.createChart(container,{
  layout:{background:{type:'solid',color:TV.bg},textColor:TV.text,fontSize:11},
  grid:{vertLines:{color:TV.grid},horzLines:{color:TV.grid}},
  rightPriceScale:{borderColor:TV.border,scaleMargins:{top:0.08,bottom:0.22}},
  timeScale:{borderColor:TV.border,timeVisible:true,secondsVisible:false,rightOffset:6,barSpacing:6,
    tickMarkFormatter:(t)=>labels[String(t)]||''},
  localization:{timeFormatter:(t)=>labels[String(t)]||''},
  crosshair:{
    mode:LightweightCharts.CrosshairMode.Normal,
    vertLine:{color:'#758696',width:1,style:LightweightCharts.LineStyle.LargeDashed,labelBackgroundColor:'#363c4e'},
    horzLine:{color:'#758696',width:1,style:LightweightCharts.LineStyle.LargeDashed,labelBackgroundColor:'#363c4e'}
  },
  handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
  handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}
});
function draw(){
  resizeOverlay();
  const w=overlay.clientWidth,h=overlay.clientHeight;
  ctx.clearRect(0,0,w,h);
  extendedRanges.forEach(r=>{
    const sx=chart.timeScale().timeToCoordinate(r.start),ex=chart.timeScale().timeToCoordinate(r.end);
    if(sx==null||ex==null)return;
    const left=Math.max(0,Math.min(sx,ex)),right=Math.min(w,Math.max(sx,ex));
    if(right<=left)return;
    ctx.fillStyle='rgba(120,123,134,0.14)';ctx.fillRect(left,0,right-left,h);
  });
  eventLines.forEach(e=>{
    const x=chart.timeScale().timeToCoordinate(e.time);if(x==null||x<0||x>w)return;
    ctx.beginPath();ctx.setLineDash([6,4]);ctx.strokeStyle=e.color;ctx.lineWidth=1.25;
    ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();ctx.setLineDash([]);
  });
}
const cs=chart.addSeries(LightweightCharts.CandlestickSeries,{
  upColor:TV.up,downColor:TV.down,borderUpColor:TV.up,borderDownColor:TV.down,
  wickUpColor:TV.up,wickDownColor:TV.down
});
cs.setData(candleData);
const vl=chart.addSeries(LightweightCharts.LineSeries,{color:'#ffffff',lineWidth:2,priceLineVisible:false,lastValueVisible:false});
vl.setData(vwapData);
const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',priceLineVisible:false,lastValueVisible:false});
vol.setData(volumeData);
chart.priceScale('volume').applyOptions({scaleMargins:{top:0.82,bottom:0},borderVisible:false});
chart.timeScale().fitContent();draw();
chart.timeScale().subscribeVisibleLogicalRangeChange(draw);
chart.subscribeCrosshairMove(param=>{
  if(!param.time){
    legendEl.textContent='Tap or drag chart for OHLC';
    return;
  }
  const cd=param.seriesData.get(cs);
  const vd=param.seriesData.get(vl);
  if(!cd){legendEl.textContent=labels[String(param.time)]||'';return;}
  const cls=cd.close>=cd.open?'up':'down';
  legendEl.innerHTML='O <b class="'+cls+'">'+fmt(cd.open)+'</b> H <b class="'+cls+'">'+fmt(cd.high)+'</b> L <b class="'+cls+'">'+fmt(cd.low)+'</b> C <b class="'+cls+'">'+fmt(cd.close)+'</b>'+(vd&&Number.isFinite(vd.value)?' · VWAP <b>'+fmt(vd.value)+'</b>':'');
});
function resizeChart(){
  chart.applyOptions({width:container.clientWidth,height:container.clientHeight});
  draw();
}
window.addEventListener('resize',resizeChart);
setTimeout(resizeChart,0);
</script></body></html>`;
}

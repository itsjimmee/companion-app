import { LIGHTWEIGHT_CHARTS_LIB } from '../generated/lightweightChartsLib';

export interface TradingViewCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TradingViewVolumeBar {
  time: number;
  value: number;
  color: string;
}

export interface TradingViewLinePoint {
  time: number;
  value: number;
}

export interface TradingViewChartData {
  title: string;
  candles: TradingViewCandle[];
  volume: TradingViewVolumeBar[];
  vwap: TradingViewLinePoint[];
  labels: Record<string, string>;
  eventLines?: { time: number; label: string; color: string }[];
  extendedRanges?: { start: number; end: number; label: string }[];
}

const CHART_INIT = String.raw`
function initTradingViewChart(opts){
  const candleData=opts.candles;
  const volumeData=opts.volume;
  const vwapData=opts.vwap;
  const eventLines=opts.eventLines||[];
  const extendedRanges=opts.extendedRanges||[];
  const labels=opts.labels;
  const container=document.getElementById('chart');
  const overlay=document.getElementById('overlay');
  const legendEl=document.getElementById('legend');
  const statusEl=document.getElementById('status');
  const ctx=overlay.getContext('2d');
  const TV={bg:'#131722',grid:'#363c4e',border:'#2a2e39',text:'#d1d4dc',up:'#26a69a',down:'#ef5350'};
  function fmt(n){return Number.isFinite(n)?n.toFixed(2):'—'}
  function showStatus(msg){if(statusEl)statusEl.textContent=msg;}
  function resizeOverlay(){
    const w=overlay.clientWidth,h=overlay.clientHeight,dpr=window.devicePixelRatio||1;
    overlay.width=Math.floor(w*dpr);overlay.height=Math.floor(h*dpr);
    overlay.style.width=w+'px';overlay.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function chartSize(){
    return {width:Math.max(container.clientWidth,320),height:Math.max(container.clientHeight,240)};
  }
  const size=chartSize();
  const chart=LightweightCharts.createChart(container,Object.assign({
    width:size.width,
    height:size.height,
    layout:{background:{type:'solid',color:TV.bg},textColor:TV.text,fontSize:11},
    grid:{vertLines:{color:TV.grid},horzLines:{color:TV.grid}},
    rightPriceScale:{borderColor:TV.border,scaleMargins:{top:0.08,bottom:0.22}},
    timeScale:{borderColor:TV.border,timeVisible:true,secondsVisible:false,rightOffset:6,barSpacing:8,minBarSpacing:4,
      tickMarkFormatter:(t)=>labels[String(t)]||''},
    localization:{timeFormatter:(t)=>labels[String(t)]||''},
    crosshair:{
      mode:LightweightCharts.CrosshairMode.Normal,
      vertLine:{color:'#758696',width:1,style:LightweightCharts.LineStyle.LargeDashed,labelBackgroundColor:'#363c4e'},
      horzLine:{color:'#758696',width:1,style:LightweightCharts.LineStyle.LargeDashed,labelBackgroundColor:'#363c4e'}
    },
    handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
    handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}
  },opts.chartOptions||{}));
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
  if(vwapData.length) vl.setData(vwapData);
  const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',priceLineVisible:false,lastValueVisible:false});
  vol.setData(volumeData);
  chart.priceScale('volume').applyOptions({scaleMargins:{top:0.82,bottom:0},borderVisible:false});
  chart.timeScale().fitContent();
  draw();
  chart.timeScale().subscribeVisibleLogicalRangeChange(draw);
  if(legendEl){
    chart.subscribeCrosshairMove(param=>{
      if(!param.time){legendEl.textContent='Tap or drag chart for OHLC';return;}
      const cd=param.seriesData.get(cs);
      const vd=param.seriesData.get(vl);
      if(!cd){legendEl.textContent=labels[String(param.time)]||'';return;}
      const cls=cd.close>=cd.open?'up':'down';
      legendEl.innerHTML='O <b class="'+cls+'">'+fmt(cd.open)+'</b> H <b class="'+cls+'">'+fmt(cd.high)+'</b> L <b class="'+cls+'">'+fmt(cd.low)+'</b> C <b class="'+cls+'">'+fmt(cd.close)+'</b>'+(vd&&Number.isFinite(vd.value)?' · VWAP <b>'+fmt(vd.value)+'</b>':'');
    });
  }
  function resizeChart(){
    const next=chartSize();
    chart.applyOptions(next);
    draw();
  }
  window.addEventListener('resize',resizeChart);
  setTimeout(resizeChart,50);
  setTimeout(resizeChart,250);
  if(statusEl) statusEl.textContent='';
  return chart;
}
`;

export function buildTradingViewChartHtml(data: TradingViewChartData): string {
  const payload = JSON.stringify({
    candles: data.candles,
    volume: data.volume,
    vwap: data.vwap,
    labels: data.labels,
    eventLines: data.eventLines ?? [],
    extendedRanges: data.extendedRanges ?? [],
  });

  return `<!doctype html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:#131722;color:#d1d4dc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;touch-action:none}
  .toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:8px 12px;border-bottom:1px solid #2a2e39;background:#131722}
  .title{font-size:12px;font-weight:600;color:#d1d4dc;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .legend{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#787b86;font-variant-numeric:tabular-nums;justify-content:flex-end}
  .legend b{color:#d1d4dc;font-weight:600}
  .legend .up{color:#26a69a}
  .legend .down{color:#ef5350}
  #status{font-size:11px;color:#787b86;padding:0 12px 6px}
  #chart{height:calc(100% - 68px);width:100%;position:relative}
  #overlay{position:absolute;inset:0;pointer-events:none;z-index:2}
  .credit{position:absolute;right:8px;bottom:4px;font-size:10px;color:#555;z-index:3;pointer-events:none}
</style></head><body>
<div class="toolbar">
  <div class="title">${escapeHtml(data.title)}</div>
  <div class="legend" id="legend">Tap or drag for OHLC</div>
</div>
<div id="status">Loading chart…</div>
<div id="chart"><canvas id="overlay"></canvas></div>
<div class="credit">TradingView Lightweight Charts</div>
<script>${LIGHTWEIGHT_CHARTS_LIB}<\/script>
<script>${CHART_INIT}
try{
  initTradingViewChart(${payload});
}catch(err){
  const statusEl=document.getElementById('status');
  if(statusEl) statusEl.textContent='Chart error: '+(err&&err.message?err.message:String(err));
}
<\/script></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function roundPrice(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function volumeColor(open: number, close: number): string {
  return close >= open ? 'rgba(38, 166, 154, 0.55)' : 'rgba(239, 83, 80, 0.55)';
}

export function nyLabel(timeSec: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timeSec * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hours = get('hour') === '24' ? '00' : get('hour');
  return `${get('month')}/${get('day')} ${hours}:${get('minute')}`;
}

export function dayLabel(timeSec: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  }).formatToParts(new Date(timeSec * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')} ${get('day')}`;
}

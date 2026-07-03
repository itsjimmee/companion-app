import { POLYGON_ADJUSTED, POLYGON_API_KEY, hasPolygonKey } from '../constants/apiKeys';
import { CandleData, StockQuote } from '../types/stock';

const POLYGON_BASE = 'https://api.polygon.io';

interface PolygonAgg {
  T?: string;
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
}

interface PolygonGroupedResult {
  T: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
}

interface PolygonTickerDetails {
  results?: {
    name?: string;
    market_cap?: number;
    share_class_shares_outstanding?: number;
  };
}

interface PolygonSnapshotTicker {
  ticker: string;
  day?: { o: number; h: number; l: number; c: number; v: number; vw?: number };
  prevDay?: { c: number; v: number };
  min?: { c: number };
  updated?: number;
}

export async function polygonFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!hasPolygonKey()) throw new Error('Polygon API key required');

  const url = new URL(`${POLYGON_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('apiKey', POLYGON_API_KEY);
  if (!params.adjusted && path.includes('/aggs/')) {
    url.searchParams.set('adjusted', POLYGON_ADJUSTED ? 'true' : 'false');
  }

  const response = await fetch(url.toString());
  const data = (await response.json()) as T & { status?: string; error?: string; message?: string };

  if (!response.ok || data.status === 'ERROR') {
    throw new Error(data.error || data.message || `Polygon error ${response.status}`);
  }

  return data;
}

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

export function isDemoMode(): boolean {
  return !hasPolygonKey();
}

function generateDemoQuote(symbol: string): StockQuote {
  const rand = seededRandom(symbol + new Date().toDateString());
  const prevClose = 5 + rand() * 45;
  const gapPercent = (rand() - 0.3) * 25;
  const open = prevClose * (1 + gapPercent / 100);
  const changePercent = (rand() - 0.45) * 15;
  const price = open * (1 + changePercent / 100);

  return {
    symbol,
    name: symbol,
    price,
    change: price - prevClose,
    changePercent: ((price - prevClose) / prevClose) * 100,
    high: price * (1 + rand() * 0.04),
    low: price * (1 - rand() * 0.04),
    open,
    previousClose: prevClose,
    volume: Math.floor(200_000 + rand() * 8_000_000),
    marketCap: Math.floor(300_000_000 + rand() * 1_700_000_000),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

export async function fetchTickerDetails(symbol: string): Promise<{ name: string; marketCap?: number; floatShares?: number }> {
  if (isDemoMode()) return { name: symbol };

  const data = await polygonFetch<PolygonTickerDetails>(`/v3/reference/tickers/${symbol}`);
  return {
    name: data.results?.name || symbol,
    marketCap: data.results?.market_cap,
    floatShares: data.results?.share_class_shares_outstanding,
  };
}

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  if (isDemoMode()) return generateDemoQuote(symbol);

  const [snapshot, details] = await Promise.all([
    polygonFetch<{ ticker?: PolygonSnapshotTicker }>(`/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`),
    fetchTickerDetails(symbol).catch(() => ({ name: symbol, marketCap: undefined as number | undefined, floatShares: undefined as number | undefined })),
  ]);

  const tick = snapshot.ticker;
  const day = tick?.day;
  const prevClose = tick?.prevDay?.c ?? day?.o ?? 0;
  const price = tick?.min?.c ?? day?.c ?? prevClose;
  const open = day?.o ?? price;
  const change = price - prevClose;

  return {
    symbol,
    name: details.name,
    price,
    change,
    changePercent: prevClose ? (change / prevClose) * 100 : 0,
    high: day?.h ?? price,
    low: day?.l ?? price,
    open,
    previousClose: prevClose,
    volume: day?.v ?? 0,
    marketCap: details.marketCap,
    floatShares: details.floatShares,
    timestamp: tick?.updated ? Math.floor(tick.updated / 1_000_000) : Math.floor(Date.now() / 1000),
  };
}

export async function fetchQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (isDemoMode()) return symbols.map(generateDemoQuote);
  return Promise.all(symbols.map(fetchQuote));
}

export async function fetchGroupedDaily(date: string): Promise<PolygonGroupedResult[]> {
  if (isDemoMode()) return [];

  const data = await polygonFetch<{ results?: PolygonGroupedResult[] }>(
    `/v2/aggs/grouped/locale/us/market/stocks/${date}`,
    { adjusted: POLYGON_ADJUSTED ? 'true' : 'false' }
  );
  return data.results ?? [];
}

export async function fetchAggs(
  symbol: string,
  multiplier: number,
  timespan: string,
  from: string,
  to: string
): Promise<PolygonAgg[]> {
  if (isDemoMode()) return [];

  const data = await polygonFetch<{ results?: PolygonAgg[] }>(
    `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`,
    { adjusted: POLYGON_ADJUSTED ? 'true' : 'false', sort: 'asc', limit: '50000' }
  );
  return data.results ?? [];
}

export async function fetchDailyBars(symbol: string, days: number): Promise<PolygonAgg[]> {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return fetchAggs(symbol, 1, 'day', formatDate(from), formatDate(to));
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function previousMarketDate(chartDate: Date): Date {
  const prev = new Date(chartDate);
  prev.setDate(prev.getDate() - 1);
  while (prev.getDay() === 0 || prev.getDay() === 6) {
    prev.setDate(prev.getDate() - 1);
  }
  return prev;
}

export async function fetchCandles(
  symbol: string,
  multiplier: number,
  timespan: string,
  days: number
): Promise<CandleData> {
  if (isDemoMode()) {
    return generateDemoCandles(symbol, days);
  }

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const aggs = await fetchAggs(symbol, multiplier, timespan, formatDate(from), formatDate(to));
  const timestamps = aggs.map((a) => Math.floor(a.t / 1000));
  const opens = aggs.map((a) => a.o);
  const highs = aggs.map((a) => a.h);
  const lows = aggs.map((a) => a.l);
  const closes = aggs.map((a) => a.c);
  const volumes = aggs.map((a) => a.v);
  const vwaps = aggs.map((a) => a.vw ?? a.c);

  return { timestamps, opens, highs, lows, closes, volumes, vwaps };
}

function generateDemoCandles(symbol: string, days: number): CandleData {
  const rand = seededRandom(symbol + String(days));
  const points = Math.min(days * 8, 120);
  const now = Math.floor(Date.now() / 1000);
  const interval = (days * 86400) / points;
  let price = 10 + rand() * 30;

  const timestamps: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];
  const vwaps: number[] = [];

  for (let i = points; i >= 0; i--) {
    const open = price;
    const move = (rand() - 0.48) * 0.04 * price;
    const close = Math.max(0.5, open + move);
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);
    const vol = Math.floor(100_000 + rand() * 2_000_000);

    timestamps.push(now - i * interval);
    opens.push(open);
    highs.push(high);
    lows.push(low);
    closes.push(close);
    volumes.push(vol);
    vwaps.push((high + low + close) / 3);
    price = close;
  }

  return { timestamps, opens, highs, lows, closes, volumes, vwaps };
}

export { PolygonAgg, PolygonGroupedResult };

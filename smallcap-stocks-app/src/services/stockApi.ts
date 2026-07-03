import Constants from 'expo-constants';
import { SMALL_CAP_UNIVERSE } from '../constants/smallCapUniverse';
import { CandleData, StockQuote, TIME_RANGE_TO_RESOLUTION, TimeRange } from '../types/stock';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

function getApiKey(): string | undefined {
  return (
    process.env.EXPO_PUBLIC_FINNHUB_API_KEY ||
    (Constants.expoConfig?.extra?.finnhubApiKey as string | undefined)
  );
}

export function isDemoMode(): boolean {
  return !getApiKey();
}

async function finnhubFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API key required');

  const url = new URL(`${FINNHUB_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  url.searchParams.set('token', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Finnhub error: ${response.status}`);
  }
  return response.json() as Promise<T>;
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

function generateDemoQuote(symbol: string, name: string): StockQuote {
  const rand = seededRandom(symbol + new Date().toDateString());
  const basePrice = 5 + rand() * 45;
  const changePercent = (rand() - 0.45) * 20;
  const change = basePrice * (changePercent / 100);
  const price = basePrice + change;
  const volume = Math.floor(200_000 + rand() * 8_000_000);

  return {
    symbol,
    name,
    price,
    change,
    changePercent,
    high: price * (1 + rand() * 0.03),
    low: price * (1 - rand() * 0.03),
    open: basePrice,
    previousClose: basePrice,
    volume,
    marketCap: Math.floor(300_000_000 + rand() * 1_700_000_000),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function generateDemoCandles(symbol: string, range: TimeRange): CandleData {
  const { days } = TIME_RANGE_TO_RESOLUTION[range];
  const rand = seededRandom(symbol + range);
  const points = range === '1D' ? 78 : range === '1W' ? 28 : Math.min(days, 120);
  const now = Math.floor(Date.now() / 1000);
  const interval = (days * 86400) / points;

  let price = 10 + rand() * 30;
  const timestamps: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];

  for (let i = points; i >= 0; i--) {
    const open = price;
    const move = (rand() - 0.48) * 0.04 * price;
    const close = Math.max(0.5, open + move);
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);

    timestamps.push(now - i * interval);
    opens.push(open);
    highs.push(high);
    lows.push(low);
    closes.push(close);
    volumes.push(Math.floor(100_000 + rand() * 2_000_000));
    price = close;
  }

  return { timestamps, opens, highs, lows, closes, volumes };
}

interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
  v?: number;
}

interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}

interface FinnhubProfile {
  name: string;
  marketCapitalization: number;
}

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const info = SMALL_CAP_UNIVERSE.find((s) => s.symbol === symbol);

  if (isDemoMode()) {
    return generateDemoQuote(symbol, info?.name ?? symbol);
  }

  const [quote, profile] = await Promise.all([
    finnhubFetch<FinnhubQuote>('/quote', { symbol }),
    finnhubFetch<FinnhubProfile>('/stock/profile2', { symbol }).catch(() => ({
      name: info?.name ?? symbol,
      marketCapitalization: 0,
    })),
  ]);

  return {
    symbol,
    name: profile.name || info?.name || symbol,
    price: quote.c,
    change: quote.d,
    changePercent: quote.dp,
    high: quote.h,
    low: quote.l,
    open: quote.o,
    previousClose: quote.pc,
    volume: quote.v ?? 0,
    marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1_000_000 : undefined,
    timestamp: quote.t,
  };
}

export async function fetchQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (isDemoMode()) {
    return symbols.map((symbol) => {
      const info = SMALL_CAP_UNIVERSE.find((s) => s.symbol === symbol);
      return generateDemoQuote(symbol, info?.name ?? symbol);
    });
  }

  const batchSize = 5;
  const results: StockQuote[] = [];

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const quotes = await Promise.all(batch.map((symbol) => fetchQuote(symbol)));
    results.push(...quotes);
    if (i + batchSize < symbols.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

export async function fetchCandles(symbol: string, range: TimeRange): Promise<CandleData> {
  if (isDemoMode()) {
    return generateDemoCandles(symbol, range);
  }

  const { resolution, days } = TIME_RANGE_TO_RESOLUTION[range];
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;

  const data = await finnhubFetch<FinnhubCandle>('/stock/candle', {
    symbol,
    resolution,
    from: from.toString(),
    to: to.toString(),
  });

  if (data.s !== 'ok') {
    throw new Error('No historical data available');
  }

  return {
    timestamps: data.t,
    opens: data.o,
    highs: data.h,
    lows: data.l,
    closes: data.c,
    volumes: data.v,
  };
}

export function createRealtimeConnection(
  symbols: string[],
  onTrade: (symbol: string, price: number, volume: number, timestamp: number) => void,
  onStatusChange?: (connected: boolean) => void
): { close: () => void } {
  const apiKey = getApiKey();

  if (!apiKey) {
    const interval = setInterval(() => {
      symbols.forEach((symbol) => {
        const quote = generateDemoQuote(
          symbol,
          SMALL_CAP_UNIVERSE.find((s) => s.symbol === symbol)?.name ?? symbol
        );
        onTrade(symbol, quote.price, quote.volume, quote.timestamp);
      });
    }, 3000);

    onStatusChange?.(true);
    return {
      close: () => {
        clearInterval(interval);
        onStatusChange?.(false);
      },
    };
  }

  const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);

  ws.onopen = () => {
    onStatusChange?.(true);
    symbols.forEach((symbol) => {
      ws.send(JSON.stringify({ type: 'subscribe', symbol }));
    });
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      if (data.type === 'trade' && Array.isArray(data.data)) {
        data.data.forEach((trade: { s: string; p: number; v: number; t: number }) => {
          onTrade(trade.s, trade.p, trade.v, Math.floor(trade.t / 1000));
        });
      }
    } catch {
      // ignore malformed messages
    }
  };

  ws.onclose = () => onStatusChange?.(false);
  ws.onerror = () => onStatusChange?.(false);

  return {
    close: () => {
      symbols.forEach((symbol) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
        }
      });
      ws.close();
      onStatusChange?.(false);
    },
  };
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y';

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  marketCap?: number;
  floatShares?: number;
  timestamp: number;
}

export interface CandleData {
  timestamps: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  vwaps?: number[];
}

export interface ScannerFilter {
  minPrice: number;
  maxPrice: number;
  minGapPercent: number;
  minChangePercent: number;
  minVolume: number;
  maxMarketCap: number;
  sortBy: 'gapPercent' | 'changePercent' | 'volume' | 'price';
  sortDirection: 'asc' | 'desc';
}

export interface ScannerResult extends StockQuote {
  gapPercent: number;
  relativeVolume?: number;
  dollarVolume?: number;
  hodPushPct?: number;
  scanMovePct?: number;
  intradayRunPct?: number;
  openToClosePct?: number;
  openToLowPct?: number;
  highToClosePct?: number;
  closedOverVwap?: boolean;
  closeVsVwapPct?: number;
  isPopDrop?: boolean;
}

export interface GapDayRow {
  date: string;
  volume: number;
  premarketVolume?: number;
  gapPercent: number;
  marketOpen?: number;
  marketClose?: number;
  closedOverVwap?: boolean;
  filingTypes?: string;
  tags?: string;
  dayChangePercent?: number;
  hodPushPct?: number;
}

export interface PremarketRow {
  date: string;
  percentageGain: number;
  spikeDurationMinutes?: number;
  premarketDollarVolume?: number;
  closedOverVwap?: boolean;
  gapped?: boolean;
  filingTypes?: string;
  tags?: string;
}

export interface AfterhoursRow {
  date: string;
  percentageGain: number;
  spikeDurationMinutes?: number;
  afterhoursDollarVolume?: number;
  closedOverVwap?: boolean;
  gapped?: boolean;
  filingTypes?: string;
  tags?: string;
}

export interface IntradayChartPayload {
  title: string;
  candles: { time: number; open: number; high: number; low: number; close: number }[];
  volume: { time: number; value: number; color: string }[];
  vwap: { time: number; value: number }[];
  labels: Record<string, string>;
  eventLines: { time: number; label: string; color: string }[];
  extendedRanges: { start: number; end: number; label: string }[];
}

export const DEFAULT_SCANNER_FILTER: ScannerFilter = {
  minPrice: 1,
  maxPrice: 50,
  minGapPercent: 5,
  minChangePercent: 2,
  minVolume: 500_000,
  maxMarketCap: 2_000_000_000,
  sortBy: 'gapPercent',
  sortDirection: 'desc',
};

export const TIME_RANGE_TO_POLYGON: Record<TimeRange, { multiplier: number; timespan: string; days: number }> = {
  '1D': { multiplier: 5, timespan: 'minute', days: 1 },
  '1W': { multiplier: 15, timespan: 'minute', days: 7 },
  '1M': { multiplier: 1, timespan: 'hour', days: 30 },
  '3M': { multiplier: 1, timespan: 'day', days: 90 },
  '6M': { multiplier: 1, timespan: 'day', days: 180 },
  '1Y': { multiplier: 1, timespan: 'day', days: 365 },
};

export type GapViewerTab = 'gaps' | 'premarket' | 'afterhours' | 'intraday_runners';

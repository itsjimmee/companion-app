export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y';

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
  timestamp: number;
}

export interface CandleData {
  timestamps: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

export interface ScannerFilter {
  minPrice: number;
  maxPrice: number;
  minChangePercent: number;
  minVolume: number;
  sortBy: 'changePercent' | 'volume' | 'price';
  sortDirection: 'asc' | 'desc';
}

export interface ScannerResult extends StockQuote {
  relativeVolume?: number;
  gapPercent?: number;
}

export const DEFAULT_SCANNER_FILTER: ScannerFilter = {
  minPrice: 1,
  maxPrice: 50,
  minChangePercent: 2,
  minVolume: 500_000,
  sortBy: 'changePercent',
  sortDirection: 'desc',
};

export const TIME_RANGE_TO_RESOLUTION: Record<TimeRange, { resolution: string; days: number }> = {
  '1D': { resolution: '5', days: 1 },
  '1W': { resolution: '15', days: 7 },
  '1M': { resolution: '60', days: 30 },
  '3M': { resolution: 'D', days: 90 },
  '6M': { resolution: 'D', days: 180 },
  '1Y': { resolution: 'D', days: 365 },
  '5Y': { resolution: 'W', days: 365 * 5 },
};

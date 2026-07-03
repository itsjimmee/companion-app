import { SMALL_CAP_SYMBOLS } from '../constants/smallCapUniverse';
import { fetchQuotes } from './stockApi';
import { DEFAULT_SCANNER_FILTER, ScannerFilter, ScannerResult, StockQuote } from '../types/stock';

export function applyScannerFilters(quotes: StockQuote[], filter: ScannerFilter): ScannerResult[] {
  const filtered = quotes
    .filter((quote) => {
      const absChange = Math.abs(quote.changePercent);
      return (
        quote.price >= filter.minPrice &&
        quote.price <= filter.maxPrice &&
        absChange >= filter.minChangePercent &&
        quote.volume >= filter.minVolume
      );
    })
    .map((quote) => ({
      ...quote,
      relativeVolume: quote.volume / filter.minVolume,
      gapPercent: quote.previousClose
        ? ((quote.open - quote.previousClose) / quote.previousClose) * 100
        : 0,
    }));

  filtered.sort((a, b) => {
    const direction = filter.sortDirection === 'asc' ? 1 : -1;
    switch (filter.sortBy) {
      case 'volume':
        return (a.volume - b.volume) * direction;
      case 'price':
        return (a.price - b.price) * direction;
      case 'changePercent':
      default:
        return (a.changePercent - b.changePercent) * direction;
    }
  });

  return filtered;
}

export async function runScanner(filter: ScannerFilter = DEFAULT_SCANNER_FILTER): Promise<ScannerResult[]> {
  const quotes = await fetchQuotes(SMALL_CAP_SYMBOLS);
  return applyScannerFilters(quotes, filter);
}

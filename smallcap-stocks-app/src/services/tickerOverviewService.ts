/**
 * Port of ticker_overview.py — Ticker Card profile data.
 */
import { polygonFetch, fetchDailyBars, isDemoMode } from './polygonApi';

export interface TickerOverview {
  ticker: string;
  profile: {
    name?: string;
    description?: string;
    exchange?: string;
    industry?: string;
    marketCap?: number;
    sharesOutstanding?: number;
    employees?: number;
    homepage?: string;
    city?: string;
    state?: string;
    country?: string;
    logoUrl?: string;
    listDate?: string;
  };
  snapshot?: {
    price?: number;
    change?: number;
    changePct?: number;
    dayHigh?: number;
    dayLow?: number;
    dayVolume?: number;
    prevClose?: number;
  };
  returns?: {
    '1W'?: number;
    '1M'?: number;
    '3M'?: number;
    '6M'?: number;
    '1Y'?: number;
    YTD?: number;
    lastClose?: number;
    asOf?: string;
  };
  display?: {
    marketCap?: string;
    sharesOutstanding?: string;
    employees?: string;
    headquarters?: string;
  };
}

function fmtMoney(n?: number): string | undefined {
  if (n == null) return undefined;
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtShares(n?: number): string | undefined {
  if (n == null) return undefined;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.floor(n));
}

function horizonReturns(closes: { date: string; close: number }[]): TickerOverview['returns'] {
  if (!closes.length) return {};
  const last = closes[closes.length - 1];
  const closeN = (n: number) => (closes.length > n ? closes[closes.length - 1 - n].close : undefined);
  const ret = (past?: number) =>
    past != null && past > 0 ? Math.round(((last.close - past) / past) * 10000) / 100 : undefined;

  const ytdYear = new Date().getFullYear();
  const ytdClose = closes.find((c) => c.date >= `${ytdYear}-01-01`)?.close;

  return {
    '1W': ret(closeN(5)),
    '1M': ret(closeN(21)),
    '3M': ret(closeN(63)),
    '6M': ret(closeN(126)),
    '1Y': ret(closeN(252)),
    YTD: ytdClose ? ret(ytdClose) : undefined,
    lastClose: last.close,
    asOf: last.date,
  };
}

export async function fetchTickerOverview(ticker: string): Promise<TickerOverview> {
  const sym = ticker.toUpperCase().trim();
  if (isDemoMode()) {
    return {
      ticker: sym,
      profile: { name: sym, exchange: 'XNAS' },
      snapshot: { price: 12.5, changePct: 2.1 },
    };
  }

  const [details, snapshot, daily] = await Promise.all([
    polygonFetch<{ results?: Record<string, unknown> }>(`/v3/reference/tickers/${sym}`).catch(() => ({
      results: {},
    })),
    polygonFetch<{ ticker?: Record<string, unknown> }>(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${sym}`
    ).catch(() => ({ ticker: {} })),
    fetchDailyBars(sym, 365 * 2),
  ]);

  const r = (details.results ?? {}) as Record<string, unknown>;
  const addr = (r.address as Record<string, string>) ?? {};
  const tick = snapshot.ticker as Record<string, Record<string, number>> | undefined;
  const day = tick?.day;
  const prev = tick?.prevDay;

  const closes = daily.map((b) => ({
    date: new Date(b.t).toISOString().slice(0, 10),
    close: b.c,
  }));

  const price = day?.c ?? tick?.min?.c;
  const prevClose = prev?.c;
  const change = price != null && prevClose != null ? price - prevClose : undefined;

  const profile = {
    name: r.name as string | undefined,
    description: ((r.description as string) ?? '').slice(0, 280) || undefined,
    exchange: (r.primary_exchange as string | undefined) ?? (r.locale as string | undefined),
    industry: r.sic_description as string | undefined,
    marketCap: r.market_cap as number | undefined,
    sharesOutstanding:
      (r.share_class_shares_outstanding as number | undefined) ??
      (r.weighted_shares_outstanding as number | undefined),
    employees: r.total_employees as number | undefined,
    homepage: r.homepage_url as string | undefined,
    city: addr.city,
    state: addr.state,
    country: addr.country,
    logoUrl: (r.icon_url as string | undefined) ?? (r.logo_url as string | undefined),
    listDate: r.list_date ? String(r.list_date).slice(0, 10) : undefined,
  };

  return {
    ticker: sym,
    profile,
    snapshot: {
      price,
      change,
      changePct:
        change != null && prevClose
          ? Math.round((change / prevClose) * 10000) / 100
          : undefined,
      dayHigh: day?.h,
      dayLow: day?.l,
      dayVolume: day?.v,
      prevClose,
    },
    returns: horizonReturns(closes),
    display: {
      marketCap: fmtMoney(profile.marketCap),
      sharesOutstanding: fmtShares(profile.sharesOutstanding),
      employees: profile.employees ? profile.employees.toLocaleString() : undefined,
      headquarters: [profile.city, profile.state, profile.country].filter(Boolean).join(', ') || undefined,
    },
  };
}

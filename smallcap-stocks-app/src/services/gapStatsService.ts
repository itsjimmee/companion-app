import { ASKEDGAR_API_KEY, hasAskEdgarKey } from '../constants/apiKeys';
import { AfterhoursRow, GapDayRow, PremarketRow } from '../types/stock';
import { fetchDailyBars, formatDate, isDemoMode, previousMarketDate } from './polygonApi';

const ASKEDGAR_BASE = 'https://eapi.askedgar.io';

function extractDate(row: Record<string, unknown>): string {
  const fields = ['date', 'gap_date', 'trading_date', 'day', 'market_date', 'session_date'];
  for (const field of fields) {
    const value = row[field];
    if (value) return String(value).slice(0, 10);
  }
  for (const [key, value] of Object.entries(row)) {
    if (key.toLowerCase().includes('date') && value) return String(value).slice(0, 10);
  }
  return '';
}

async function fetchAskEdgarPages(endpoint: string, ticker: string): Promise<Record<string, unknown>[]> {
  if (!hasAskEdgarKey()) throw new Error('AskEdgar API key required');

  const results: Record<string, unknown>[] = [];
  let page = 1;

  while (true) {
    const url = new URL(`${ASKEDGAR_BASE}/v1/${endpoint}`);
    url.searchParams.set('ticker', ticker);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', '100');

    const response = await fetch(url.toString(), {
      headers: { 'API-KEY': ASKEDGAR_API_KEY },
    });
    if (!response.ok) throw new Error(`AskEdgar error ${response.status}`);
    const payload = await response.json();
    const pageResults = payload.results ?? [];
    if (!Array.isArray(pageResults)) throw new Error('Unexpected AskEdgar response');
    results.push(...pageResults);
    if (!payload.has_more) break;
    page += 1;
  }

  return results;
}

function mapGapRow(row: Record<string, unknown>): GapDayRow {
  return {
    date: extractDate(row),
    volume: Number(row.volume ?? 0),
    premarketVolume: row.premarket_volume != null ? Number(row.premarket_volume) : undefined,
    gapPercent: Number(row.gap_percentage ?? 0),
    marketOpen: row.market_open != null ? Number(row.market_open) : undefined,
    marketClose: row.market_close != null ? Number(row.market_close) : undefined,
    closedOverVwap: row.closed_over_vwap as boolean | undefined,
    filingTypes: Array.isArray(row.filing_types) ? row.filing_types.join(', ') : String(row.filing_types ?? ''),
    tags: Array.isArray(row.all_tags) ? row.all_tags.join(', ') : String(row.all_tags ?? ''),
  };
}

function mapPremarketRow(row: Record<string, unknown>): PremarketRow {
  return {
    date: extractDate(row),
    percentageGain: Number(row.percentage_gain ?? 0),
    spikeDurationMinutes: row.spike_duration_minutes != null ? Number(row.spike_duration_minutes) : undefined,
    premarketDollarVolume: row.premarket_dollar_volume != null ? Number(row.premarket_dollar_volume) : undefined,
    closedOverVwap:
      row.market_open != null && row.premarket_vwap != null
        ? Number(row.market_open) >= Number(row.premarket_vwap)
        : undefined,
    filingTypes: Array.isArray(row.filing_types) ? row.filing_types.join(', ') : String(row.filing_types ?? ''),
    tags: Array.isArray(row.all_tags) ? row.all_tags.join(', ') : String(row.all_tags ?? ''),
  };
}

function mapAfterhoursRow(row: Record<string, unknown>): AfterhoursRow {
  return {
    date: extractDate(row),
    percentageGain: Number(row.percentage_gain ?? 0),
    spikeDurationMinutes: row.spike_duration_minutes != null ? Number(row.spike_duration_minutes) : undefined,
    afterhoursDollarVolume:
      row.afterhours_dollar_volume != null ? Number(row.afterhours_dollar_volume) : undefined,
    closedOverVwap:
      row.afterhours_close != null && row.afterhours_vwap != null
        ? Number(row.afterhours_close) >= Number(row.afterhours_vwap)
        : undefined,
    filingTypes: Array.isArray(row.filing_types) ? row.filing_types.join(', ') : String(row.filing_types ?? ''),
    tags: Array.isArray(row.all_tags) ? row.all_tags.join(', ') : String(row.all_tags ?? ''),
  };
}

/** Compute gap days from Polygon daily bars when AskEdgar is unavailable. */
export async function computeGapDaysFromPolygon(ticker: string, minGapPercent = 5): Promise<GapDayRow[]> {
  const bars = await fetchDailyBars(ticker, 120);
  if (bars.length < 2) return [];

  const rows: GapDayRow[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    if (!prev.c || !curr.o) continue;
    const gapPercent = ((curr.o - prev.c) / prev.c) * 100;
    if (Math.abs(gapPercent) < minGapPercent) continue;

    const typical = (curr.h + curr.l + curr.c) / 3;
    const vwap = curr.vw ?? typical;

    rows.push({
      date: formatDate(new Date(curr.t)),
      volume: curr.v,
      gapPercent,
      marketOpen: curr.o,
      marketClose: curr.c,
      closedOverVwap: curr.c >= vwap,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchGapDays(ticker: string): Promise<GapDayRow[]> {
  if (hasAskEdgarKey()) {
    const rows = await fetchAskEdgarPages('gap-stats', ticker);
    return rows.map(mapGapRow).filter((r) => r.date);
  }
  if (isDemoMode()) return generateDemoGapDays(ticker);
  return computeGapDaysFromPolygon(ticker);
}

export async function fetchPremarketDays(ticker: string): Promise<PremarketRow[]> {
  if (hasAskEdgarKey()) {
    const rows = await fetchAskEdgarPages('premarket-stats', ticker);
    return rows.map(mapPremarketRow).filter((r) => r.date);
  }
  return generateDemoPremarketDays(ticker);
}

export async function fetchAfterhoursDays(ticker: string): Promise<AfterhoursRow[]> {
  if (hasAskEdgarKey()) {
    const rows = await fetchAskEdgarPages('afterhours-stats', ticker);
    return rows.map(mapAfterhoursRow).filter((r) => r.date);
  }
  return generateDemoAfterhoursDays(ticker);
}

function generateDemoGapDays(ticker: string): GapDayRow[] {
  const rand = (s: string) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
    return () => {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      return h / 0x7fffffff;
    };
  };
  const r = rand(ticker);
  const rows: GapDayRow[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 3);
    const gap = 10 + r() * 80;
    rows.push({
      date: formatDate(d),
      volume: Math.floor(500_000 + r() * 5_000_000),
      premarketVolume: Math.floor(50_000 + r() * 500_000),
      gapPercent: gap,
      marketOpen: 5 + r() * 20,
      marketClose: 5 + r() * 25,
      closedOverVwap: r() > 0.4,
      filingTypes: r() > 0.7 ? 'S-1, 8-K' : '',
      tags: r() > 0.6 ? 'dilution, offering' : '',
    });
  }
  return rows;
}

function generateDemoPremarketDays(ticker: string): PremarketRow[] {
  return generateDemoGapDays(ticker).map((g) => ({
    date: g.date,
    percentageGain: g.gapPercent * 0.6,
    spikeDurationMinutes: 15 + Math.floor(Math.random() * 90),
    premarketDollarVolume: g.premarketVolume ? g.premarketVolume * (g.marketOpen ?? 10) : undefined,
    closedOverVwap: g.closedOverVwap,
    gapped: g.gapPercent > 20,
    filingTypes: g.filingTypes,
    tags: g.tags,
  }));
}

function generateDemoAfterhoursDays(ticker: string): AfterhoursRow[] {
  return generateDemoGapDays(ticker).map((g) => ({
    date: g.date,
    percentageGain: (Math.random() - 0.3) * 20,
    spikeDurationMinutes: 10 + Math.floor(Math.random() * 60),
    afterhoursDollarVolume: g.volume * 0.1 * (g.marketClose ?? 10),
    closedOverVwap: Math.random() > 0.5,
    gapped: g.gapPercent > 30,
    filingTypes: g.filingTypes,
    tags: g.tags,
  }));
}

export { previousMarketDate };

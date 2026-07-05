#!/usr/bin/env node
/**
 * Smoke test for polygon_scan port — gaps + intraday on a recent trading day.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const key = process.env.EXPO_PUBLIC_POLYGON_API_KEY || process.env.POLYGON_API_KEY || '';
if (!key) {
  console.error('❌ No Polygon key');
  process.exit(1);
}

const date = '2025-06-27';
const url = (path) =>
  `https://api.polygon.io${path}${path.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(key)}&adjusted=false`;

const grouped = await fetch(url(`/v2/aggs/grouped/locale/us/market/stocks/${date}`)).then((r) => r.json());
const prev = await fetch(url(`/v2/aggs/grouped/locale/us/market/stocks/2025-06-26`)).then((r) => r.json());

const prevMap = new Map((prev.results ?? []).map((r) => [r.T, r.c]));
let gapCount = 0;
let runCount = 0;

for (const bar of grouped.results ?? []) {
  const pc = prevMap.get(bar.T);
  if (!bar.o || bar.c < 0.3 || bar.v < 30000) continue;
  if (pc) {
    const gap = Math.abs(((bar.o - pc) / pc) * 100);
    if (gap >= 5) gapCount++;
  }
  const run = Math.max(((bar.h - bar.o) / bar.o) * 100, bar.c >= bar.o ? ((bar.h - bar.l) / bar.l) * 100 : 0);
  if (run >= 5) runCount++;
}

console.log(`✅ Grouped daily ${date}: ${(grouped.results ?? []).length} tickers`);
console.log(`   Gaps ≥5%: ${gapCount} · Intraday runs ≥5%: ${runCount}`);

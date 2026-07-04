#!/usr/bin/env node
/**
 * iPad Safari test server — serves a touch-friendly test page + API checks.
 * Usage: node scripts/ipad-test-server.mjs
 *        node scripts/ipad-test-server.mjs --tunnel
 */
import { config } from 'dotenv';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
config({ path: resolve(ROOT, '.env') });

const PORT = Number(process.env.IPAD_TEST_PORT || 8090);
const useTunnel = process.argv.includes('--tunnel');
const EXPO_URL = process.env.EXPO_TUNNEL_URL || 'exp://ptceeck-anonymous-8081.exp.direct';

const key = process.env.EXPO_PUBLIC_POLYGON_API_KEY || process.env.POLYGON_API_KEY || '';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

async function verifyPolygon() {
  if (!key) return { ok: false, error: 'No Polygon API key in .env' };
  const url = `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=false&apiKey=${encodeURIComponent(key)}`;
  const data = await fetch(url).then((r) => r.json());
  if (data.status === 'OK' || data.results) {
    const close = data.results?.[0]?.c;
    return { ok: true, message: 'Polygon API key is valid.', aaplClose: close != null ? close.toFixed(2) : null };
  }
  return { ok: false, error: data.error || data.message || 'Polygon rejected key' };
}

async function verifyScanner() {
  if (!key) return { ok: false, error: 'No Polygon API key' };

  const date = '2025-06-27';
  const prevDate = '2025-06-26';
  const api = (path) =>
    `https://api.polygon.io${path}${path.includes('?') ? '&' : '?'}apiKey=${encodeURIComponent(key)}&adjusted=false`;

  const [grouped, prev] = await Promise.all([
    fetch(api(`/v2/aggs/grouped/locale/us/market/stocks/${date}`)).then((r) => r.json()),
    fetch(api(`/v2/aggs/grouped/locale/us/market/stocks/${prevDate}`)).then((r) => r.json()),
  ]);

  const results = grouped.results ?? [];
  const prevMap = new Map((prev.results ?? []).map((r) => [r.T, r.c]));
  let gapCount = 0;
  let runCount = 0;
  const topGaps = [];

  for (const bar of results) {
    const pc = prevMap.get(bar.T);
    if (!bar.o || bar.c < 0.3 || bar.v < 30000) continue;

    let gapPct = 0;
    if (pc) {
      gapPct = ((bar.o - pc) / pc) * 100;
      if (Math.abs(gapPct) >= 5) {
        gapCount++;
        if (topGaps.length < 8) topGaps.push({ symbol: bar.T, gapPercent: gapPct });
      }
    }

    const run = Math.max(
      ((bar.h - bar.o) / bar.o) * 100,
      bar.c >= bar.o ? ((bar.h - bar.l) / bar.l) * 100 : 0
    );
    if (run >= 5) runCount++;
  }

  topGaps.sort((a, b) => Math.abs(b.gapPercent) - Math.abs(a.gapPercent));

  return {
    ok: true,
    date,
    tickerCount: results.length,
    gapCount,
    runCount,
    topGaps,
  };
}

const html = readFileSync(resolve(ROOT, 'test-ipad/index.html'), 'utf8');

const server = createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];

  if (path === '/' || path === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (path === '/api/meta') {
    json(res, 200, { expoUrl: EXPO_URL, port: PORT });
    return;
  }

  if (path === '/api/run-all') {
    try {
      const [polygon, scanner] = await Promise.all([verifyPolygon(), verifyScanner()]);
      json(res, 200, {
        serverTime: new Date().toISOString(),
        polygon,
        scanner,
      });
    } catch (e) {
      json(res, 500, { error: e.message || String(e) });
    }
    return;
  }

  if (path === '/api/health') {
    json(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', async () => {
  const local = `http://localhost:${PORT}`;
  console.log(`iPad test server: ${local}`);

  if (useTunnel) {
    try {
      const { spawn } = await import('child_process');
      const cf = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      cf.stdout.on('data', (chunk) => {
        const m = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (m) printTunnel(m[0]);
      });
      cf.stderr.on('data', (chunk) => {
        const m = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (m) printTunnel(m[0]);
      });
      cf.on('error', () => console.log('Tunnel failed — run: npx cloudflared tunnel --url http://localhost:' + PORT));
    } catch {
      console.log('Run tunnel manually: npx cloudflared tunnel --url http://localhost:' + PORT);
    }
  } else {
    console.log('Tip: run with --tunnel for iPad access from anywhere');
  }
});

function printTunnel(url) {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  Open on iPad Safari:');
  console.log('  ' + url);
  console.log('');
  console.log('  If the link stops working, ask the agent to restart test:ipad.');
  console.log('═══════════════════════════════════════════');
  console.log('');
}

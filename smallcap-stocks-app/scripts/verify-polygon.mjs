#!/usr/bin/env node
/**
 * Verifies Polygon API key is available and valid.
 * Cloud Agents: set POLYGON_API_KEY and/or EXPO_PUBLIC_POLYGON_API_KEY in dashboard secrets.
 */
const key =
  process.env.EXPO_PUBLIC_POLYGON_API_KEY ||
  process.env.POLYGON_API_KEY ||
  '';

if (!key) {
  console.error('❌ No Polygon key found.');
  console.error('   Set POLYGON_API_KEY or EXPO_PUBLIC_POLYGON_API_KEY in Cursor → Cloud Agents → Secrets.');
  process.exit(1);
}

const which = process.env.EXPO_PUBLIC_POLYGON_API_KEY ? 'EXPO_PUBLIC_POLYGON_API_KEY' : 'POLYGON_API_KEY';
console.log(`Checking ${which}...`);

const url = `https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=false&apiKey=${encodeURIComponent(key)}`;
const res = await fetch(url);
const data = await res.json();

if (data.status === 'OK' || data.results) {
  console.log('✅ Polygon API key is valid.');
  process.exit(0);
}

console.error('❌ Polygon API rejected the key:', data.error || data.message || data.status);
process.exit(1);

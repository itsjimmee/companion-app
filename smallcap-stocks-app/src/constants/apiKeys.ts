import Constants from 'expo-constants';

/** Polygon key: Cloud Secrets POLYGON_API_KEY, .env EXPO_PUBLIC_POLYGON_API_KEY, or app.json extra */
export const POLYGON_API_KEY =
  process.env.EXPO_PUBLIC_POLYGON_API_KEY ||
  process.env.POLYGON_API_KEY ||
  (Constants.expoConfig?.extra?.polygonApiKey as string | undefined) ||
  '';

export const ASKEDGAR_API_KEY =
  process.env.EXPO_PUBLIC_ASKEDGAR_API_KEY ||
  process.env.ASKEDGAR_API_KEY ||
  (Constants.expoConfig?.extra?.askedgarApiKey as string | undefined) ||
  '';

export function hasPolygonKey(): boolean {
  return Boolean(POLYGON_API_KEY);
}

export function hasAskEdgarKey(): boolean {
  return Boolean(ASKEDGAR_API_KEY);
}

/** Match polygon_scan.py — unadjusted OHLC for historical gap study */
export const POLYGON_ADJUSTED = false;

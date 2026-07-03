import Constants from 'expo-constants';

/**
 * Polygon API key — set EXPO_PUBLIC_POLYGON_API_KEY, app.json extra.polygonApiKey,
 * or paste your key from Ticker Card GUI V08 below.
 */
export const POLYGON_API_KEY =
  process.env.EXPO_PUBLIC_POLYGON_API_KEY ||
  (Constants.expoConfig?.extra?.polygonApiKey as string | undefined) ||
  '';

export const ASKEDGAR_API_KEY =
  process.env.EXPO_PUBLIC_ASKEDGAR_API_KEY ||
  (Constants.expoConfig?.extra?.askedgarApiKey as string | undefined) ||
  '';

export function hasPolygonKey(): boolean {
  return Boolean(POLYGON_API_KEY);
}

export function hasAskEdgarKey(): boolean {
  return Boolean(ASKEDGAR_API_KEY);
}

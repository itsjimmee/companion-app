export const colors = {
  background: '#0B0F1A',
  surface: '#141B2D',
  surfaceElevated: '#1C2640',
  border: '#2A3555',
  primary: '#3B82F6',
  primaryMuted: '#2563EB',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  chartLine: '#60A5FA',
  chartGradientStart: 'rgba(59, 130, 246, 0.35)',
  chartGradientEnd: 'rgba(59, 130, 246, 0)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const },
  headline: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  mono: { fontSize: 15, fontWeight: '500' as const, fontVariant: ['tabular-nums'] as const },
};

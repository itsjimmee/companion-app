import { useMemo } from 'react';
import { TradingViewChart } from './TradingViewChart';
import { buildChartHtml } from '../services/gapChartService';
import { IntradayChartPayload } from '../types/stock';

interface GapDayChartProps {
  payload: IntradayChartPayload;
  height?: number;
}

export function GapDayChart({ payload, height = 520 }: GapDayChartProps) {
  const html = useMemo(() => buildChartHtml(payload), [payload]);
  const reloadKey = `${payload.title}-${payload.candles.length}-${payload.candles[0]?.time ?? 0}`;

  return <TradingViewChart html={html} height={height} reloadKey={reloadKey} />;
}

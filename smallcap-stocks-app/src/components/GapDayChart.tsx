import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildChartHtml } from '../services/gapChartService';
import { IntradayChartPayload } from '../types/stock';
import { colors } from '../constants/theme';

interface GapDayChartProps {
  payload: IntradayChartPayload;
  height?: number;
}

export function GapDayChart({ payload, height = 360 }: GapDayChartProps) {
  const html = buildChartHtml(payload);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1a1a2e',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
});

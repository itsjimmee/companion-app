import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../constants/theme';

interface TradingViewChartProps {
  html: string;
  height?: number;
  reloadKey?: string;
}

export function TradingViewChart({ html, height = 520, reloadKey }: TradingViewChartProps) {
  return (
    <View style={[styles.container, { height }]}>
      <WebView
        key={reloadKey}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://local.chart' }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
        cacheEnabled={false}
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
    backgroundColor: '#131722',
  },
  webview: { flex: 1, backgroundColor: '#131722' },
});

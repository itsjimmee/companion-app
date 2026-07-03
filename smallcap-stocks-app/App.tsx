import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WatchlistProvider } from './src/context/WatchlistContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <WatchlistProvider>
        <AppNavigator />
        <StatusBar style="light" />
      </WatchlistProvider>
    </SafeAreaProvider>
  );
}

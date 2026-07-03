import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../constants/theme';
import { ScannerScreen } from '../screens/ScannerScreen';
import { GapViewerScreen } from '../screens/GapViewerScreen';
import { WatchlistScreen } from '../screens/WatchlistScreen';
import { StockDetailScreen } from '../screens/StockDetailScreen';
import { GapDayScreen } from '../screens/GapDayScreen';
import { MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Scanner: '◎',
    Gaps: '📊',
    Watchlist: '★',
  };
  return (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.5 }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 84,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scanner' }} />
      <Tab.Screen name="Gaps" component={GapViewerScreen} options={{ title: 'Gaps' }} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} options={{ title: 'Watchlist' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="StockDetail"
          component={StockDetailScreen}
          options={({ route }) => ({ title: route.params.symbol, headerBackTitle: 'Back' })}
        />
        <Stack.Screen
          name="GapDay"
          component={GapDayScreen}
          options={({ route }) => ({
            title: `${route.params.symbol} ${route.params.date}`,
            headerBackTitle: 'Back',
          })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export type RootStackParamList = {
  MainTabs: undefined;
  StockDetail: { symbol: string; name: string };
  GapDay: { symbol: string; date: string };
};

export type MainTabParamList = {
  Scanner: undefined;
  Gaps: undefined;
  Watchlist: undefined;
};

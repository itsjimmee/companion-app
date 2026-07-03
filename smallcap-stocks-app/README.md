# SmallCap Scanner — iPhone App

React Native (Expo) iOS app for **small-cap stock scanning** and **historical gap chart viewing**, powered by **Polygon.io** (ported from Ticker Card GUI V08 + historical-gap-chart-viewer).

## Features

### Scanner (Ticker V08 style)
- **Polygon grouped-daily gap scanner** — scans the full US market for gap-ups/gap-downs
- **V08-style ticker cards** — gap %, relative volume, market cap, OHLCV footer
- Filters: min gap %, change %, volume, price range ($1–$50 default)
- Small-cap market cap filter (default &lt; $2B)

### Gap Chart Viewer (historical-gap-chart-viewer)
- **Gaps / Premarket / After Hours** tabs per ticker
- **Intraday 3-min candle charts** with VWAP, session overlays (premarket, AH)
- TradingView Lightweight Charts via WebView
- AskEdgar integration for rich gap stats (optional)
- Polygon fallback: computes gap days from daily bars

### Stock Detail + Watchlist
- Polygon snapshot quotes
- Historical price charts (1D–1Y)
- Jump to gap-day intraday chart
- Persistent watchlist

## Setup

```bash
cd smallcap-stocks-app
npm install
```

Add your Polygon API key (same key from `Ticker Card GUI V08.py`):

```bash
# .env
EXPO_PUBLIC_POLYGON_API_KEY=your_polygon_key_here

# Optional — for AskEdgar gap/premarket/afterhours tables
EXPO_PUBLIC_ASKEDGAR_API_KEY=your_askedgar_key_here
```

Or set in `app.json` → `extra.polygonApiKey`.

```bash
npm start
```

Scan QR with **Expo Go 54** on iPhone.

## Architecture

```
src/
  services/
    polygonApi.ts       # Polygon REST (snapshots, aggs, grouped daily)
    scannerService.ts     # Gap scanner (JLEAK grouped-daily logic)
    gapStatsService.ts    # Gap/premarket/AH stats (AskEdgar + Polygon)
    gapChartService.ts    # Intraday chart prep (historical_charts.py port)
  components/
    TickerCard.tsx        # V08-style rich ticker card
    GapDayChart.tsx       # TradingView WebView chart
  screens/
    ScannerScreen.tsx     # Market-wide gap scanner
    GapViewerScreen.tsx   # Per-ticker gap history
    GapDayScreen.tsx      # Single-day intraday chart
```

## Data Sources

| Feature | API |
|---------|-----|
| Scanner | Polygon `/v2/aggs/grouped/locale/us/market/stocks/{date}` |
| Live quotes | Polygon `/v2/snapshot/locale/us/markets/stocks/tickers/{symbol}` |
| Intraday charts | Polygon `/v2/aggs/ticker/{sym}/range/3/minute/...` |
| Gap stats (rich) | AskEdgar `gap-stats`, `premarket-stats`, `afterhours-stats` |
| Gap stats (fallback) | Computed from Polygon daily bars |

## Reference Projects Ported

- `Polygon/Working Code/Ticker Card GUI V08.py` → TickerCard UI + Polygon scanner
- `historical-gap-chart-viewer-public` → Gap tabs, intraday VWAP charts, gap % color coding

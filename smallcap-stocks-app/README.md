# SmallCap Scanner — iPhone App

A React Native (Expo) iOS app for monitoring **small-cap US stocks** with real-time scanning and historical price charts.

## Features

- **Real-Time Scanner** — Filters 30+ small-cap tickers by % change, volume, and price range with live WebSocket updates
- **Historical Data** — Interactive price charts across 1D, 1W, 1M, 3M, 6M, 1Y, and 5Y timeframes
- **Stock Detail** — Quote stats, market cap, OHLCV data, and chart visualization
- **Watchlist** — Save favorites locally with AsyncStorage
- **Demo Mode** — Works out of the box with simulated data (no API key required)

## Quick Start

```bash
cd smallcap-stocks-app
npm install
npm start
```

Press `i` to open in the iOS Simulator (requires macOS + Xcode), or scan the QR code with **Expo Go** on your iPhone.

## Live Market Data

For real-time quotes and historical candles, get a free API key from [Finnhub](https://finnhub.io/) and create a `.env` file:

```bash
EXPO_PUBLIC_FINNHUB_API_KEY=your_api_key_here
```

Restart the Expo dev server after adding the key.

## Building for iPhone (App Store)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure and build
eas build:configure
eas build --platform ios
```

You'll need an Apple Developer account ($99/year) to distribute via TestFlight or the App Store.

## Small Cap Universe

The scanner monitors a curated list of actively traded US small caps (approx. $300M–$2B market cap) including SOFI, PLUG, RKLB, IONQ, SOUN, and more. Edit `src/constants/smallCapUniverse.ts` to customize the ticker list.

## Project Structure

```
src/
  components/     # StockCard, PriceChart, ScannerFilters
  constants/      # Theme, small-cap ticker universe
  context/        # Watchlist state
  hooks/          # useScanner, useHistoricalData
  navigation/     # Tab + stack navigation
  screens/        # Scanner, Historical, Watchlist, Detail
  services/       # Finnhub API + demo data
  types/          # TypeScript interfaces
  utils/          # Formatting helpers
```

## Tech Stack

- Expo SDK 57 / React Native
- React Navigation (tabs + native stack)
- react-native-chart-kit for price charts
- Finnhub API (quotes, candles, WebSocket trades)

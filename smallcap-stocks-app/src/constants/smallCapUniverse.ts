export interface SmallCapSymbol {
  symbol: string;
  name: string;
  sector: string;
}

/** Curated universe of actively traded US small-cap stocks (approx. $300M–$2B market cap). */
export const SMALL_CAP_UNIVERSE: SmallCapSymbol[] = [
  { symbol: 'SOFI', name: 'SoFi Technologies', sector: 'Financial' },
  { symbol: 'PLUG', name: 'Plug Power', sector: 'Energy' },
  { symbol: 'ACHR', name: 'Archer Aviation', sector: 'Industrials' },
  { symbol: 'RKLB', name: 'Rocket Lab', sector: 'Aerospace' },
  { symbol: 'OPEN', name: 'Opendoor Technologies', sector: 'Real Estate' },
  { symbol: 'JOBY', name: 'Joby Aviation', sector: 'Aerospace' },
  { symbol: 'SOUN', name: 'SoundHound AI', sector: 'Technology' },
  { symbol: 'MP', name: 'MP Materials', sector: 'Materials' },
  { symbol: 'LAC', name: 'Lithium Americas', sector: 'Materials' },
  { symbol: 'IONQ', name: 'IonQ', sector: 'Technology' },
  { symbol: 'UPST', name: 'Upstart Holdings', sector: 'Financial' },
  { symbol: 'HIMS', name: 'Hims & Hers Health', sector: 'Healthcare' },
  { symbol: 'ASTS', name: 'AST SpaceMobile', sector: 'Telecom' },
  { symbol: 'RGTI', name: 'Rigetti Computing', sector: 'Technology' },
  { symbol: 'QUBT', name: 'Quantum Computing', sector: 'Technology' },
  { symbol: 'BBAI', name: 'BigBear.ai', sector: 'Technology' },
  { symbol: 'TMC', name: 'TMC the metals company', sector: 'Materials' },
  { symbol: 'LAZR', name: 'Luminar Technologies', sector: 'Technology' },
  { symbol: 'SPCE', name: 'Virgin Galactic', sector: 'Aerospace' },
  { symbol: 'DNA', name: 'Ginkgo Bioworks', sector: 'Healthcare' },
  { symbol: 'CLOV', name: 'Clover Health', sector: 'Healthcare' },
  { symbol: 'SKLZ', name: 'Skillz', sector: 'Technology' },
  { symbol: 'CORZ', name: 'Core Scientific', sector: 'Technology' },
  { symbol: 'BTBT', name: 'Bit Digital', sector: 'Technology' },
  { symbol: 'MARA', name: 'MARA Holdings', sector: 'Technology' },
  { symbol: 'RIOT', name: 'Riot Platforms', sector: 'Technology' },
  { symbol: 'WULF', name: 'TeraWulf', sector: 'Technology' },
  { symbol: 'APLD', name: 'Applied Digital', sector: 'Technology' },
  { symbol: 'NVTS', name: 'Navitas Semiconductor', sector: 'Technology' },
  { symbol: 'RUN', name: 'Sunrun', sector: 'Energy' },
];

export const SMALL_CAP_SYMBOLS = SMALL_CAP_UNIVERSE.map((s) => s.symbol);

export function getSymbolInfo(symbol: string): SmallCapSymbol | undefined {
  return SMALL_CAP_UNIVERSE.find((s) => s.symbol === symbol);
}

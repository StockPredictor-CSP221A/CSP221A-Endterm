export const STOCKS = [
  {
    symbol: 'SPY',
    name: 'S&P 500 ETF',
    role: 'Safe',
    description: 'Broad US large-cap exposure and the locked benchmark asset.',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    role: 'Volatile',
    description: 'High-beta semiconductor name with larger price swings.',
  },
  {
    symbol: 'KO',
    name: 'Coca-Cola',
    role: 'Defensive',
    description: 'Low-volatility consumer staple with a contrasting regime.',
  },
] as const

export type StockSymbol = (typeof STOCKS)[number]['symbol']

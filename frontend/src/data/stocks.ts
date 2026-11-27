import type { StockRole } from '@/types'

/** Client copy of the fixed universe; the API's /stocks list is authoritative. */
export const STOCKS = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', role: 'Safe' },
  { symbol: 'NVDA', name: 'NVIDIA', role: 'Volatile' },
  { symbol: 'KO', name: 'Coca-Cola', role: 'Defensive' },
] as const satisfies readonly { symbol: string; name: string; role: StockRole }[]

export type StockSymbol = (typeof STOCKS)[number]['symbol']

export const STOCK_SYMBOLS: readonly StockSymbol[] = STOCKS.map((stock) => stock.symbol)

export function isStockSymbol(value: string | undefined): value is StockSymbol {
  return value !== undefined && (STOCK_SYMBOLS as readonly string[]).includes(value)
}

/** Mirrors the backend's ticker format check (app/services/market_data.py). */
const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,9}$/

/** Uppercases and trims a ticker, or returns null when it cannot be a valid symbol. */
export function normalizeTicker(value: string | undefined): string | null {
  const cleaned = value?.trim().toUpperCase() ?? ''
  return TICKER_PATTERN.test(cleaned) ? cleaned : null
}

/** Most tickers a user can add on top of the default three (backend MAX_ADDED_STOCKS). */
export const MAX_ADDED_STOCKS = 20

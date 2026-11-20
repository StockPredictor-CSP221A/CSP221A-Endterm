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

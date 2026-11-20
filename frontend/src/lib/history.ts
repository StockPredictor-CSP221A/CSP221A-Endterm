import type { PricePoint } from '@/types'

export interface HistorySummary {
  last: PricePoint
  previous: PricePoint | null
  dailyChange: number | null
  dailyChangePercent: number | null
  periodChange: number
  periodChangePercent: number
  high: number
  low: number
  count: number
}

export function summarizeHistory(prices: PricePoint[]): HistorySummary | null {
  const last = prices.at(-1)
  const first = prices[0]
  if (!last || !first) return null

  const previous = prices.at(-2) ?? null
  const dailyChange = previous ? last.close - previous.close : null
  let high = -Infinity
  let low = Infinity
  for (const point of prices) {
    high = Math.max(high, point.close)
    low = Math.min(low, point.close)
  }

  return {
    last,
    previous,
    dailyChange,
    dailyChangePercent:
      previous && dailyChange !== null && previous.close !== 0
        ? dailyChange / previous.close
        : null,
    periodChange: last.close - first.close,
    periodChangePercent: first.close !== 0 ? (last.close - first.close) / first.close : 0,
    high,
    low,
    count: prices.length,
  }
}

export const queryKeys = {
  stocks: ['stocks'] as const,
  history: (symbol: string, period: string) => ['history', symbol, period] as const,
  predictions: ['predictions'] as const,
  watchlist: ['watchlist'] as const,
  news: (symbol: string, limit: number) => ['news', symbol, limit] as const,
  predictionList: (symbol: string | undefined, limit: number) =>
    ['predictions', { symbol: symbol ?? 'all', limit }] as const,
}

export const queryKeys = {
  stocks: ['stocks'] as const,
  history: (symbol: string, period: string) => ['history', symbol, period] as const,
}

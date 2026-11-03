export interface BenchmarkRow {
  model: string
  mae: number
  rmse: number
  nmae: number
  nrmse: number
  directional: number | null
  badge?: string
  shipped?: boolean
}

export const BENCHMARK: {
  asset: string
  testPeriod: string
  rows: BenchmarkRow[]
} = {
  asset: 'SPY',
  testPeriod: 'Jan 2 – Dec 31, 2025',
  rows: [
    {
      model: 'Naive previous close',
      mae: 4.459,
      rmse: 6.8681,
      nmae: 0.0072,
      nrmse: 0.0111,
      directional: null,
      badge: 'Lowest MAE',
    },
    {
      model: 'Google TimesFM 2.5',
      mae: 4.5301,
      rmse: 7.1305,
      nmae: 0.0073,
      nrmse: 0.0115,
      directional: 0.576,
      badge: 'Shipped',
      shipped: true,
    },
    {
      model: 'Amazon Chronos-2',
      mae: 4.8028,
      rmse: 7.1883,
      nmae: 0.0077,
      nrmse: 0.0116,
      directional: 0.512,
    },
  ],
}

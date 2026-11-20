export interface ModelMetrics {
  model: string
  asset: string
  testPeriod: string
  mae: number
  rmse: number
  nmae: number
  nrmse: number
  directional: number
}

export const MODEL_METRICS: ModelMetrics = {
  model: 'Google TimesFM 2.5',
  asset: 'SPY',
  testPeriod: 'Jan 2 – Dec 31, 2025',
  mae: 4.5301,
  rmse: 7.1305,
  nmae: 0.0073,
  nrmse: 0.0115,
  directional: 0.576,
}

export interface HealthResponse {
  status: string
  service: string
  version: string
}

export interface PricePoint {
  date: string
  close: number
}

export interface StockHistory {
  symbol: string
  interval: string
  prices: PricePoint[]
}

export interface Prediction {
  symbol: string
  forecast_horizon: string
  last_observed_date: string
  last_observed_close: number
  forecast_date: string
  predicted_close: number
  model_name: string
  disclaimer: string
}

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

export interface User {
  id: number
  email: string
  display_name: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload extends LoginPayload {
  display_name?: string | null
}

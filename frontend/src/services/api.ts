import type { HealthResponse, Prediction, StockHistory } from '../types'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(detail || `Request failed with status ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  history: (symbol: string, period = '1y') =>
    request<StockHistory>(
      `/stocks/${encodeURIComponent(symbol)}/history?period=${period}`,
    ),

  predict: (symbol: string) =>
    request<Prediction>(`/stocks/${encodeURIComponent(symbol)}/predict`, {
      method: 'POST',
    }),
}

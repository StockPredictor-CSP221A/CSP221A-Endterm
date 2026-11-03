import { clearToken, getToken } from '@/lib/auth-token'
import type {
  LoginPayload,
  Prediction,
  RegisterPayload,
  StockHistory,
  TokenResponse,
  User,
} from '@/types'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let onUnauthorized: (() => void) | null = null

/** Called after a signed-in request is rejected with 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

interface ValidationIssue {
  msg?: unknown
}

function detailMessage(detail: unknown): string | null {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0] as ValidationIssue | undefined
    if (first && typeof first.msg === 'string') return first.msg
  }
  return null
}

async function errorMessage(res: Response): Promise<string> {
  const fallback = `Request failed with status ${res.status}`
  const text = await res.text().catch(() => '')
  if (!text) return fallback
  try {
    const body = JSON.parse(text) as { detail?: unknown }
    return detailMessage(body.detail) ?? fallback
  } catch {
    return fallback
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

async function request<T>(
  path: string,
  { method = 'GET', body, signal }: RequestOptions = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      'Could not reach the server. Check your connection and try again.',
      0,
    )
  }

  if (!res.ok) {
    const message = await errorMessage(res)
    if (res.status === 401 && token) {
      clearToken()
      onUnauthorized?.()
    }
    throw new ApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function symbolPath(symbol: string): string {
  return `/stocks/${encodeURIComponent(symbol)}`
}

export const api = {
  auth: {
    register: (payload: RegisterPayload) =>
      request<TokenResponse>('/auth/register', { method: 'POST', body: payload }),
    login: (payload: LoginPayload) =>
      request<TokenResponse>('/auth/login', { method: 'POST', body: payload }),
    me: (signal?: AbortSignal) => request<User>('/auth/me', { signal }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },

  history: (symbol: string, period = '1y', signal?: AbortSignal) =>
    request<StockHistory>(
      `${symbolPath(symbol)}/history?period=${encodeURIComponent(period)}`,
      { signal },
    ),

  predict: (symbol: string) =>
    request<Prediction>(`${symbolPath(symbol)}/predict`, { method: 'POST' }),
}

export function errorText(error: unknown, fallback = 'Something went wrong'): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const TOKEN_KEY = 'stock_predictor_token'

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage can be unavailable (private mode); the session lasts this tab.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clear.
  }
}

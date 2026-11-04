import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { clearToken, getToken, setToken } from '@/lib/auth-token'
import { api, setUnauthorizedHandler } from '@/services/api'
import type { LoginPayload, RegisterPayload, TokenResponse, User } from '@/types'

import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(() => getToken() !== null)

  const endSession = useCallback(() => {
    clearToken()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(endSession)
    return () => setUnauthorizedHandler(null)
  }, [endSession])

  useEffect(() => {
    if (!getToken()) return
    const controller = new AbortController()

    api.auth
      .me(controller.signal)
      .then(setUser)
      // A 401 ends the session through the unauthorized handler. Network
      // errors keep the token so a flaky connection does not sign anyone out.
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [endSession])

  const startSession = useCallback(
    (response: TokenResponse) => {
      queryClient.clear()
      setToken(response.access_token)
      setUser(response.user)
      return response.user
    },
    [queryClient],
  )

  const login = useCallback(
    async (payload: LoginPayload) => startSession(await api.auth.login(payload)),
    [startSession],
  )

  const register = useCallback(
    async (payload: RegisterPayload) =>
      startSession(await api.auth.register(payload)),
    [startSession],
  )

  const logout = useCallback(() => {
    void api.auth.logout().catch(() => undefined)
    endSession()
  }, [endSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

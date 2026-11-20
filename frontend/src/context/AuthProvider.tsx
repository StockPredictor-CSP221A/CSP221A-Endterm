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

  const signInWithGoogle = useCallback(
    async (credential: string) => startSession(await api.auth.google(credential)),
    [startSession],
  )

  const signInWithGitHub = useCallback(
    async (code: string, redirectUri: string) =>
      startSession(await api.auth.github(code, redirectUri)),
    [startSession],
  )

  const updateProfile = useCallback(async (displayName: string | null) => {
    const updated = await api.auth.updateProfile(displayName)
    setUser(updated)
    return updated
  }, [])

  const changeEmail = useCallback(async (newEmail: string, currentPassword: string) => {
    const updated = await api.auth.changeEmail(newEmail, currentPassword)
    setUser(updated)
    return updated
  }, [])

  // The server signs out every other session and hands back a new token for
  // this one, so swap it in without clearing cached data.
  const changePassword = useCallback(
    async (newPassword: string, currentPassword: string | null) => {
      const response = await api.auth.changePassword(newPassword, currentPassword)
      setToken(response.access_token)
      setUser(response.user)
      return response.user
    },
    [],
  )

  const deleteAccount = useCallback(
    async (confirmEmail: string, currentPassword: string | null) => {
      await api.auth.deleteAccount(confirmEmail, currentPassword)
      endSession()
    },
    [endSession],
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
      signInWithGoogle,
      signInWithGitHub,
      updateProfile,
      changeEmail,
      changePassword,
      deleteAccount,
      logout,
    }),
    [
      user,
      isLoading,
      login,
      register,
      signInWithGoogle,
      signInWithGitHub,
      updateProfile,
      changeEmail,
      changePassword,
      deleteAccount,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

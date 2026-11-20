import { createContext } from 'react'

import type { LoginPayload, RegisterPayload, User } from '@/types'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  signInWithGoogle: (credential: string) => Promise<User>
  signInWithGitHub: (code: string, redirectUri: string) => Promise<User>
  updateProfile: (displayName: string | null) => Promise<User>
  changeEmail: (newEmail: string, currentPassword: string) => Promise<User>
  changePassword: (newPassword: string, currentPassword: string | null) => Promise<User>
  deleteAccount: (confirmEmail: string, currentPassword: string | null) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

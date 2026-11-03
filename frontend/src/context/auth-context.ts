import { createContext } from 'react'

import type { LoginPayload, RegisterPayload, User } from '@/types'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

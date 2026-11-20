import { lazy, Suspense, type ComponentType } from 'react'
import { Route, Routes } from 'react-router-dom'

import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/RouteGuards'
import { PageSkeleton } from '@/components/common/PageSkeleton'
import { AppShell } from '@/components/layout/AppShell'
import { NotFoundPage } from '@/pages/NotFoundPage'

const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) =>
  lazy(() => load().then((module) => ({ default: module[key] })))

const DashboardPage = named(() => import('@/pages/DashboardPage'), 'DashboardPage')
const StockDetailPage = named(() => import('@/pages/StockDetailPage'), 'StockDetailPage')
const WatchlistPage = named(() => import('@/pages/WatchlistPage'), 'WatchlistPage')
const HistoryPage = named(() => import('@/pages/HistoryPage'), 'HistoryPage')
const SignInPage = named(() => import('@/pages/SignInPage'), 'SignInPage')
const SignUpPage = named(() => import('@/pages/SignUpPage'), 'SignUpPage')

export function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="sign-up" element={<SignUpPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="stocks/:symbol" element={<StockDetailPage />} />
            <Route path="watchlist" element={<WatchlistPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

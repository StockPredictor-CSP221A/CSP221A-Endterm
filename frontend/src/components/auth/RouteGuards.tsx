import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { PageSkeleton } from '@/components/common/PageSkeleton'
import { Wordmark } from '@/components/layout/Wordmark'
import { useAuth } from '@/hooks/useAuth'
import { redirectTarget } from '@/lib/redirect'

function BootScreen() {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
      <div className="flex h-[70px] items-center">
        <Wordmark />
      </div>
      <div className="py-8">
        <PageSkeleton />
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <BootScreen />
  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <BootScreen />
  if (isAuthenticated) {
    return <Navigate to={redirectTarget(location.state)} replace />
  }
  return <Outlet />
}

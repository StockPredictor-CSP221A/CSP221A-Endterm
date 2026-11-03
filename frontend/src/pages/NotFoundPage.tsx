import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Wordmark } from '@/components/layout/Wordmark'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col px-4 py-6 sm:px-8">
      <Wordmark />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-mono text-sm text-brand">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          The page you are looking for does not exist or has moved. The app
          covers SPY, NVDA, and KO only.
        </p>
        <Button asChild size="lg" className="mt-8 px-4">
          <Link to="/">
            <ArrowLeft aria-hidden />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}

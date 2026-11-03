import { AlertTriangle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-xl border border-loss/25 bg-loss/5 p-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-loss" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
          className="shrink-0"
        >
          <RotateCw aria-hidden className={cn(retrying && 'animate-spin')} />
          Retry
        </Button>
      )}
    </div>
  )
}

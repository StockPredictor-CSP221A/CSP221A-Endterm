import { ChartSpline } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn(
        'inline-flex items-center gap-2.5 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-primary-foreground">
        <ChartSpline aria-hidden className="size-4.5" strokeWidth={2.25} />
      </span>
      <span className="text-[15px]">
        Stock<span className="text-brand">Predictor</span>
      </span>
    </Link>
  )
}

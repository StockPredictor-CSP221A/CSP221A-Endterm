import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}

export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card px-4 py-3.5',
        className,
      )}
    >
      <dt className="label-caps">{label}</dt>
      <dd className="mt-1.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

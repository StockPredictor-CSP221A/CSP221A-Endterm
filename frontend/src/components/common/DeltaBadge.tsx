import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { formatSignedCurrency, formatSignedPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

interface DeltaBadgeProps {
  /** Fractional change, e.g. 0.0123 for +1.23%. */
  percent: number
  /** Optional absolute change shown before the percentage. */
  amount?: number
  size?: 'sm' | 'md'
  className?: string
}

export function DeltaBadge({
  percent,
  amount,
  size = 'sm',
  className,
}: DeltaBadgeProps) {
  const direction = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat'
  const Icon =
    direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
  const label =
    direction === 'up' ? 'Up' : direction === 'down' ? 'Down' : 'Unchanged'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium tabular-nums',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        direction === 'up' && 'bg-gain/10 text-gain',
        direction === 'down' && 'bg-loss/10 text-loss',
        direction === 'flat' && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      <span className="sr-only">{label}</span>
      {amount !== undefined && <span>{formatSignedCurrency(amount)}</span>}
      <span>
        {amount !== undefined ? `(${formatSignedPercent(percent)})` : formatSignedPercent(percent)}
      </span>
    </span>
  )
}

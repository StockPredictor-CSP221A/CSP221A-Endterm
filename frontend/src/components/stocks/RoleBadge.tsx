import { Activity, ShieldCheck, Umbrella, type LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StockRole } from '@/types'

const ROLE_ICONS: Record<StockRole, LucideIcon> = {
  Safe: ShieldCheck,
  Volatile: Activity,
  Defensive: Umbrella,
}

export function RoleBadge({ role, className }: { role: StockRole; className?: string }) {
  const Icon = ROLE_ICONS[role]
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 border-border bg-surface/60 text-muted-foreground', className)}
    >
      <Icon aria-hidden className="size-3" />
      {role}
    </Badge>
  )
}

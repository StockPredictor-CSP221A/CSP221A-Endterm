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
      <img src="/star-logo.svg" alt="" aria-hidden className="size-8" />
      <span className="text-[15px]">
        Progno<span className="text-brand">Stock</span>
      </span>
    </Link>
  )
}

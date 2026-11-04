import { ArrowUpRight } from 'lucide-react'

import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { NewsItem } from '@/types'

interface NewsListProps {
  items: NewsItem[]
  className?: string
}

export function NewsList({ items, className }: NewsListProps) {
  return (
    <ul className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col justify-between gap-4 rounded-xl border border-border bg-card p-4 outline-none transition-colors hover:border-input hover:bg-surface/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <p className="line-clamp-3 text-sm leading-snug font-medium group-hover:text-brand">
              {item.title}
            </p>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">
                {item.publisher ?? 'Source'}
                {item.published_at && (
                  <>
                    {' · '}
                    <time dateTime={item.published_at}>
                      {formatRelativeTime(item.published_at)}
                    </time>
                  </>
                )}
              </span>
              <ArrowUpRight aria-hidden className="size-3.5 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}

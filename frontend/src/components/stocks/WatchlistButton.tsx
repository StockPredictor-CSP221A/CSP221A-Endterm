import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useIsWatched, useToggleWatchlist, useWatchlist } from '@/hooks/useWatchlist'
import { cn } from '@/lib/utils'

interface WatchlistButtonProps {
  symbol: string
  /** "icon" for cards, "full" for page headers. */
  variant?: 'icon' | 'full'
  className?: string
}

export function WatchlistButton({ symbol, variant = 'icon', className }: WatchlistButtonProps) {
  const watchlist = useWatchlist()
  const watched = useIsWatched(symbol)
  const toggle = useToggleWatchlist()
  const label = watched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`
  const disabled = watchlist.isPending || toggle.isPending

  const icon = (
    <Star
      aria-hidden
      className={cn('transition-colors', watched && 'fill-brand text-brand')}
    />
  )

  if (variant === 'full') {
    return (
      <Button
        variant="outline"
        className={cn('h-10 px-4', className)}
        aria-pressed={watched}
        disabled={disabled}
        onClick={() => toggle.mutate({ symbol, watch: !watched })}
      >
        {icon}
        {watched ? 'Watching' : 'Add to watchlist'}
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={className}
          aria-label={label}
          aria-pressed={watched}
          disabled={disabled}
          onClick={() => toggle.mutate({ symbol, watch: !watched })}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{watched ? 'Remove from watchlist' : 'Add to watchlist'}</TooltipContent>
    </Tooltip>
  )
}

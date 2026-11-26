import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { RoleBadge } from '@/components/stocks/RoleBadge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { STOCKS, normalizeTicker } from '@/data/stocks'
import { useAddStock, useWatchlist } from '@/hooks/useWatchlist'

import { errorText } from '@/services/api'

import { NAV_ITEMS } from './nav'

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const watchlist = useWatchlist()
  const addStock = useAddStock()

  const added = (watchlist.data ?? []).filter((entry) => !entry.is_default)
  const stocks = [...STOCKS, ...added]
  const ticker = normalizeTicker(search)
  const canAdd = ticker !== null && !stocks.some((stock) => stock.symbol === ticker)

  function addAndOpen(symbol: string) {
    setOpen(false)
    addStock.mutate(symbol, {
      onSuccess: (entry) => navigate(`/stocks/${entry.symbol}`),
      onError: (error) =>
        toast.error(`Could not add ${symbol}`, { description: errorText(error) }),
    })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 gap-2 px-2.5 text-muted-foreground sm:w-56 sm:justify-start"
        aria-label="Search stocks"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search aria-hidden />
        <span className="hidden sm:inline">Search stocks…</span>
        <kbd className="pointer-events-none ml-auto hidden rounded border border-border bg-surface px-1.5 font-sans text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setSearch('')
        }}
        title="Search stocks"
        description="Jump to a stock on your watchlist or a page, or add a new ticker."
      >
        <Command>
          <CommandInput
            placeholder="Search stocks or type a ticker to add…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matches. Type a ticker like AAPL to add it.</CommandEmpty>
            {canAdd && (
              <CommandGroup heading="Add">
                <CommandItem
                  forceMount
                  value={`add ${ticker}`}
                  onSelect={() => addAndOpen(ticker)}
                  className="gap-3 py-2"
                >
                  <Plus aria-hidden />
                  Add <span className="font-semibold">{ticker}</span> to watchlist
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Stocks">
              {stocks.map((stock) => (
                <CommandItem
                  key={stock.symbol}
                  value={`${stock.symbol} ${stock.name}`}
                  onSelect={() => go(`/stocks/${stock.symbol}`)}
                  className="gap-3 py-2"
                >
                  <span className="w-12 font-semibold">{stock.symbol}</span>
                  <span className="flex-1 truncate text-muted-foreground">{stock.name}</span>
                  <RoleBadge role={stock.role} />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {NAV_ITEMS.map((item) => (
                <CommandItem key={item.to} value={item.label} onSelect={() => go(item.to)}>
                  <item.icon aria-hidden />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

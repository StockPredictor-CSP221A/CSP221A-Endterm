import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
import { STOCKS } from '@/data/stocks'

import { NAV_ITEMS } from './nav'

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

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
        onOpenChange={setOpen}
        title="Search stocks"
        description="Jump to SPY, NVDA, or KO, or to a page."
      >
        <Command>
          <CommandInput placeholder="Search SPY, NVDA, KO…" />
          <CommandList>
            <CommandEmpty>Only SPY, NVDA, and KO are supported.</CommandEmpty>
            <CommandGroup heading="Stocks">
              {STOCKS.map((stock) => (
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

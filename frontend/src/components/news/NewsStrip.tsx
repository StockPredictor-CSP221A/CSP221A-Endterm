import { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { STOCK_SYMBOLS } from '@/data/stocks'
import { useNewsFor } from '@/hooks/useNews'

import { NewsList } from './NewsList'

/** Dashboard headlines per symbol. Renders nothing when no symbol has news. */
export function NewsStrip() {
  const results = useNewsFor(STOCK_SYMBOLS)
  const available = STOCK_SYMBOLS.flatMap((symbol, index) => {
    const items = results[index]?.data
    return items && items.length > 0 ? [{ symbol, items }] : []
  })
  const [selected, setSelected] = useState<string | null>(null)

  if (available.length === 0) return null
  const active = available.some((entry) => entry.symbol === selected)
    ? (selected as string)
    : available[0].symbol

  return (
    <section aria-labelledby="news-heading" className="space-y-4">
      <Tabs value={active} onValueChange={setSelected} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="news-heading" className="text-lg font-semibold">
            Headlines
          </h2>
          <TabsList aria-label="Headlines by symbol" className="h-9">
            {available.map((entry) => (
              <TabsTrigger
                key={entry.symbol}
                value={entry.symbol}
                className="px-3 text-xs data-[state=active]:text-brand"
              >
                {entry.symbol}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {available.map((entry) => (
          <TabsContent key={entry.symbol} value={entry.symbol}>
            <NewsList items={entry.items} />
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-muted-foreground">Headlines via Yahoo Finance.</p>
    </section>
  )
}

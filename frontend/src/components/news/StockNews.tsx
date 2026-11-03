import { useNews } from '@/hooks/useNews'

import { NewsList } from './NewsList'

/** Headlines for one symbol. Renders nothing while loading, on error, or when empty. */
export function StockNews({ symbol }: { symbol: string }) {
  const news = useNews(symbol, 4)
  if (!news.data || news.data.length === 0) return null

  return (
    <section aria-labelledby="stock-news-heading" className="space-y-4">
      <h2 id="stock-news-heading" className="text-lg font-semibold">
        {symbol} headlines
      </h2>
      <NewsList items={news.data} />
      <p className="text-xs text-muted-foreground">Headlines via Yahoo Finance.</p>
    </section>
  )
}

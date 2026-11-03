import { STOCKS, type StockSymbol } from '@/data/stocks'

interface StockSelectorProps {
  selected: StockSymbol
  onSelect: (symbol: StockSymbol) => void
}

export function StockSelector({ selected, onSelect }: StockSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Choose a stock"
      className="grid gap-3 sm:grid-cols-3"
    >
      {STOCKS.map((stock) => {
        const active = stock.symbol === selected
        return (
          <button
            key={stock.symbol}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(stock.symbol)}
            className={`rounded-2xl border p-4 text-left transition ${
              active
                ? 'border-brand bg-primary text-primary-foreground shadow-lg shadow-black/40'
                : 'border-border bg-card text-foreground hover:border-input hover:bg-surface'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold">{stock.symbol}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  active
                    ? 'bg-card/15 text-primary-foreground'
                    : 'bg-surface text-muted-foreground'
                }`}
              >
                {stock.role}
              </span>
            </div>
            <p
              className={`mt-1 text-sm ${
                active ? 'text-muted-foreground' : 'text-muted-foreground'
              }`}
            >
              {stock.name}
            </p>
          </button>
        )
      })}
    </div>
  )
}

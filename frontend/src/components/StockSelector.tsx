import { STOCKS, type StockSymbol } from '../data/stocks'

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
                ? 'border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold">{stock.symbol}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {stock.role}
              </span>
            </div>
            <p
              className={`mt-1 text-sm ${
                active ? 'text-slate-200' : 'text-slate-600'
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

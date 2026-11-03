import { PERIODS, type Period } from '@/data/periods'

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Chart range"
      className="inline-flex self-start rounded-lg border border-border bg-surface p-1"
    >
      {PERIODS.map((period) => {
        const active = period.value === value
        return (
          <button
            key={period.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(period.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {period.label}
          </button>
        )
      })}
    </div>
  )
}

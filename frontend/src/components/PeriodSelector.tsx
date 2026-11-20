import { PERIODS, type Period } from '../data/periods'

interface PeriodSelectorProps {
  value: Period
  onChange: (period: Period) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Chart range"
      className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-50 p-1"
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
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {period.label}
          </button>
        )
      })}
    </div>
  )
}

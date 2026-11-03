import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PERIODS, type Period } from '@/data/periods'

interface PeriodTabsProps {
  value: Period
  onChange: (period: Period) => void
}

export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as Period)}>
      <TabsList aria-label="Chart period" className="h-9">
        {PERIODS.map((period) => (
          <TabsTrigger
            key={period.value}
            value={period.value}
            className="px-3 text-xs data-[state=active]:text-brand"
          >
            {period.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

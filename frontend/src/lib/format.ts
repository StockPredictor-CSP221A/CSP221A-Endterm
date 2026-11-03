const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 0,
})

const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const signedPercent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

function parseDate(iso: string): Date {
  return iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
}

export function formatCurrency(value: number): string {
  return currency.format(value)
}

export function formatCompactCurrency(value: number): string {
  return compactCurrency.format(value)
}

export function formatSignedCurrency(value: number): string {
  if (value === 0) return currency.format(0)
  const sign = value > 0 ? '+' : '-'
  return `${sign}${currency.format(Math.abs(value))}`
}

export function formatPercent(value: number): string {
  return percent.format(value)
}

export function formatSignedPercent(value: number): string {
  return signedPercent.format(value)
}

export function formatDate(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatShortDate(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return parseDate(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = (parseDate(iso).getTime() - now) / 1000
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit)
    }
  }
  return 'just now'
}

export function formatMetric(value: number): string {
  return value.toFixed(4)
}

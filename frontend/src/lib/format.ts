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

function parseDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

export function formatCurrency(value: number): string {
  return currency.format(value)
}

export function formatCompactCurrency(value: number): string {
  return compactCurrency.format(value)
}

export function formatSignedCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${currency.format(Math.abs(value))}`
}

export function formatPercent(value: number): string {
  return percent.format(value)
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

export function formatMetric(value: number): string {
  return value.toFixed(4)
}

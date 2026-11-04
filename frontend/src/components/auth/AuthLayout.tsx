import { CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { Wordmark } from '@/components/layout/Wordmark'
import { STOCKS } from '@/data/stocks'

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

const HIGHLIGHTS = [
  'Google TimesFM 2.5, zero-shot, one trading day ahead',
  'Benchmarked against a naive baseline on 2025 SPY data',
  'Forecast history and watchlist saved to your account',
]

function ChartPreview() {
  return (
    <svg
      viewBox="0 0 480 200"
      className="h-auto w-full"
      role="presentation"
      aria-hidden
    >
      <defs>
        <linearGradient id="auth-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[40, 90, 140].map((y) => (
        <line
          key={y}
          x1="0"
          x2="480"
          y1={y}
          y2={y}
          stroke="white"
          strokeOpacity="0.06"
        />
      ))}
      <path
        d="M0 150 C40 140 60 120 90 128 S140 96 170 104 S220 70 250 86 S300 60 330 72 S380 40 410 52 L410 200 L0 200 Z"
        fill="url(#auth-area)"
      />
      <path
        d="M0 150 C40 140 60 120 90 128 S140 96 170 104 S220 70 250 86 S300 60 330 72 S380 40 410 52"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M410 52 L455 40"
        fill="none"
        stroke="var(--gain)"
        strokeWidth="2.5"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      <circle cx="410" cy="52" r="4" fill="var(--brand)" />
      <circle cx="455" cy="40" r="5" fill="var(--gain)" />
      <circle cx="455" cy="40" r="11" fill="var(--gain)" fillOpacity="0.15" />
    </svg>
  )
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <Wordmark />
        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Forecasts are uncertain and are not financial advice.
        </p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-border bg-card lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgb(253_212_88/0.10),transparent_55%)]"
        />
        <div className="relative max-w-xl">
          <p className="label-caps text-brand">Next-day close forecasts</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Three stocks. One model.
            <br />
            <span className="text-muted-foreground">Measured, not hyped.</span>
          </h2>

          <div className="mt-10 rounded-xl border border-border bg-background/60 p-5">
            <div className="flex flex-wrap gap-2">
              {STOCKS.map((stock) => (
                <span
                  key={stock.symbol}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs"
                >
                  <span className="font-semibold">{stock.symbol}</span>
                  <span className="text-muted-foreground">{stock.role}</span>
                </span>
              ))}
            </div>
            <div className="mt-5">
              <ChartPreview />
            </div>
          </div>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

import { Outlet } from 'react-router-dom'

import { SiteHeader } from './SiteHeader'

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-1 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>Data: yfinance daily closes. Model: Google TimesFM 2.5.</p>
          <p>Forecasts are uncertain and are not financial advice.</p>
        </div>
      </footer>
    </div>
  )
}

# Frontend (Vite + React + TypeScript)

SPA for the stock predictor: React 19, Tailwind CSS v4, shadcn/ui (Radix),
React Router, TanStack Query, react-hook-form + zod, and Recharts through the
shadcn chart wrapper.

## Setup

```bash
npm ci
npm run dev      # http://localhost:5173
npm run lint     # oxlint
npm run build    # type-check + production build
```

`/api` requests are proxied to the backend at `http://localhost:8000` (see
`vite.config.ts`). For a deployed backend set `VITE_API_BASE` to its `/api` URL
(see `.env.example`). It is the only frontend environment variable.

## Pages

| Route | Page | Notes |
| --- | --- | --- |
| `/sign-in` | `SignInPage` | public; redirects signed-in users |
| `/sign-up` | `SignUpPage` | public; inline validation, duplicate-email error on the field |
| `/` | `DashboardPage` | snapshot, stock cards, recent forecasts, watchlist, model performance, headlines |
| `/stocks/:symbol` | `StockDetailPage` | chart with 1M–5Y tabs, stats, forecast card, history, headlines; `?forecast=run` starts a forecast |
| `/watchlist` | `WatchlistPage` | starred stocks |
| `/history` | `HistoryPage` | saved forecasts, `?symbol=` filter |
| `*` | `NotFoundPage` | |

App routes sit behind `ProtectedRoute`; unauthenticated users are sent to
`/sign-in` and returned to the original URL afterwards. Pages are lazy-loaded.

## Structure

```text
src/
├── App.tsx            # routes
├── main.tsx           # providers: error boundary, query client, router, auth, tooltips, toaster
├── components/
│   ├── ui/            # shadcn/ui primitives (generated; see components.json)
│   ├── layout/        # app shell, header, nav, mobile sheet, ⌘K command menu, user menu
│   ├── auth/          # auth layout, route guards, password input
│   ├── common/        # EmptyState, ErrorState, PageSkeleton, StatCard, DeltaBadge, ...
│   ├── stocks/        # StockCard, Sparkline, PriceChart, RoleBadge, WatchlistButton
│   ├── forecast/      # ForecastCard, PredictionHistoryTable, RecentPredictions
│   ├── news/          # NewsList, NewsStrip, StockNews
│   └── ...
├── context/           # AuthProvider
├── hooks/             # query/mutation hooks (stocks, forecast, predictions, watchlist, news)
├── lib/               # formatting, query keys, token storage, cn helper
├── services/api.ts    # typed API client
├── data/              # universe, periods, benchmark rows
└── types/             # API types
```

## Conventions

- Auth: the bearer token is stored in `localStorage` (`stock_predictor_token`).
  Any `401` on a signed-in request clears it and ends the session.
- Server state lives in TanStack Query. Keys are in `lib/query-keys.ts`; a
  forecast invalidates `predictions`, watchlist changes update `watchlist`
  optimistically and roll back on failure. Query functions pass the abort
  signal through to `fetch`.
- Theme: one dark theme defined as CSS variables in `src/index.css` (yellow
  brand accent, teal gains, red losses). Use token classes (`bg-card`,
  `text-muted-foreground`, `text-gain`, ...) rather than raw colors.
- Add shadcn components with `npx shadcn@latest add <name>`. This version's
  `CommandDialog` needs an explicit `<Command>` root inside it.

## Deployment

The Vercel project Root Directory is `frontend`; `vercel.json` rewrites every
path to `index.html` for client-side routing. Deploy from the repo root:

```bash
VERCEL_ORG_ID=team_EaEujHq5CUZvuHjXAzEEXjap \
VERCEL_PROJECT_ID=prj_xhcxU3f4Av5NesiNEqcNSr3poErr \
vercel --prod --yes
```

Do not run `vercel` inside `frontend/`; the Root Directory setting would resolve
to `frontend/frontend`.

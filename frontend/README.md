# Frontend (Vite + React + TypeScript)

SPA for the stock predictor. Tailwind CSS for styling, Recharts for charts.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint     # oxlint
```

`/api` requests are proxied to the backend at `http://localhost:8000` (see
`vite.config.ts`). Override the base URL with `VITE_API_BASE` if needed.

## Structure

```text
src/
├── App.tsx         # dashboard, state, data fetching, predict flow
├── components/     # stock/period selectors, history chart, predict + eval panels
├── data/           # locked universe, periods, benchmark rows
├── lib/            # currency/date/percent formatting
├── services/       # typed API client
├── types/          # shared API types
└── index.css       # Tailwind entry
```

The app is limited to `SPY`, `NVDA`, and `KO`. It loads 1M/6M/1Y/5Y daily
history, shows the latest close, runs `POST /api/stocks/{symbol}/predict`, draws
the forecast as a dashed segment, and displays the SPY benchmark table.

## Deployment

The Vercel project Root Directory is `frontend`. Deploy from the repo root:

```bash
VERCEL_ORG_ID=team_EaEujHq5CUZvuHjXAzEEXjap \
VERCEL_PROJECT_ID=prj_xhcxU3f4Av5NesiNEqcNSr3poErr \
vercel --prod --yes
```

Do not run `vercel` inside `frontend/`; the Root Directory setting would resolve
to `frontend/frontend`. Pushes to `main` or `feature/benchmarking` deploy through
`.github/workflows/deploy-frontend.yml`; add a `VERCEL_TOKEN` repository secret
scoped to the `mikkel13` Vercel team.

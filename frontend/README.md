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
├── App.tsx         # dashboard shell
├── components/     # UI pieces (charts, panels) — added next
├── services/       # typed API client
├── types/          # shared API types
└── index.css       # Tailwind entry
```

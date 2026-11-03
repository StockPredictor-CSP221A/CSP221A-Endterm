# Stock Predictor

A stock-tracking web app with an ML-powered next-day closing-price forecast for
`SPY`, `NVDA`, and `KO`.

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, Recharts
- **Backend:** Python + FastAPI, Pydantic, SQLAlchemy 2 (PostgreSQL), Alembic
- **Market data:** `yfinance`
- **Model:** Google TimesFM 2.5 (live); benchmarked against Chronos-2 and a naive
  baseline; see the benchmark section below

This is an academic demonstration. Forecasts are uncertain and are not
financial advice.

## Layout

```text
├── frontend/   # Vite + React + TypeScript SPA
├── backend/    # FastAPI app (routes, services, ml, db, schemas)
└── opencode.md # project brief, decisions, and deployment plan
```

## Backend

```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL if needed
uv sync                       # create venv + install deps
uv run uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health
- Tests: `uv run pytest`
- Lint: `uv run ruff check .`

Endpoints so far:

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | liveness/version |
| GET | `/api/health/db` | checks the configured PostgreSQL (Neon) connection |
| GET | `/api/stocks/{symbol}/history?period=1y` | real daily closes via yfinance |
| POST | `/api/stocks/{symbol}/predict` | TimesFM one-day forecast; persists to `predictions` |

Migrations: `uv run alembic upgrade head` (requires a reachable PostgreSQL). The
initial `predictions` migration is already committed; generate new ones with
`uv run alembic revision --autogenerate -m "..."`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173 and proxies `/api` to the backend on port 8000.
For a deployed backend, set `VITE_API_BASE=https://<backend-host>/api` (see
`frontend/.env.example`).

The UI is limited to `SPY`, `NVDA`, and `KO`. It loads 1M/6M/1Y/5Y history,
shows the latest close/date, runs the TimesFM forecast with idle/loading/success/
error states, draws the forecast as a dashed segment, and shows the SPY
benchmark table with the shipped-model trade-off.

## Deployment (live, free tier)

| Layer | Service | URL |
| --- | --- | --- |
| Frontend | Vercel Hobby | <https://stock-predictor-omega-five.vercel.app> |
| Backend | Modal Starter | <https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run> |
| Database | Neon Free | pooled PostgreSQL |

```bash
# Live checks
curl https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run/api/health
curl https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run/api/health/db
curl "https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run/api/stocks/NVDA/history?period=1mo"
curl -X POST "https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run/api/stocks/SPY/predict"
```

The first prediction after a deploy reloads TimesFM (about 30–50 s); warm calls
are about 7 s. Model weights are cached in the `stock-predictor-hf-cache` Modal
Volume.

The backend is `backend/modal_app.py` (FastAPI ASGI). The Modal secret
`stock-predictor-api` holds `DATABASE_URL` and `CORS_ORIGINS`. The frontend is a
Vite SPA on Vercel with `VITE_API_BASE` pointing at the Modal endpoint.

```bash
# Backend deploy
cd backend
modal secret create stock-predictor-api --force \
  DATABASE_URL='postgresql+psycopg://...neon.tech/neondb?sslmode=require' \
  'CORS_ORIGINS=["https://stock-predictor-omega-five.vercel.app"]'
modal deploy modal_app.py
modal app rollover stock-predictor-api   # after changing a secret

# Frontend deploy (from repo root; Vercel Root Directory is frontend)
cd <repo-root>
VERCEL_ORG_ID=team_EaEujHq5CUZvuHjXAzEEXjap \
VERCEL_PROJECT_ID=prj_xhcxU3f4Av5NesiNEqcNSr3poErr \
vercel --prod --yes
```

Frontend pushes to `main` or `feature/benchmarking` deploy through
`.github/workflows/deploy-frontend.yml`. Add a `VERCEL_TOKEN` repository secret
(token scoped to the `mikkel13` Vercel team). The Vercel GitHub App is not
installed on the `StockPredictor-CSP221A` org, so the project uses GitHub Actions
instead of native Git integration. Run Vercel commands from the repo root; the
project Root Directory is `frontend`.

Hugging Face Docker Spaces now return `402 Payment Required` on free accounts,
and free ZeroGPU Spaces require an account at least 30 days old, so Modal is the
free backend host. `backend/Dockerfile` is kept for local or alternate hosts.
CI runs backend tests and the frontend build; the deploy workflows use
`MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET` and `VERCEL_TOKEN` repository secrets.

The `predictions` migration is applied to Neon, and `/predict` persists each
forecast. Full limits and the CORS loop are in `opencode.md` Section 15.

## Benchmark

The locked SPY benchmark is implemented as an isolated `uv` project in
`experiments/`. It compares Amazon Chronos-2, Google TimesFM 2.5, and a naive
previous-close baseline on identical data and splits.

```bash
cd experiments
uv sync
uv run python run_benchmark.py --split test
```

One-shot 2025 test result (SPY, 1,024-day past-only context, one-day horizon,
median forecast, CPU):

| Model | MAE | RMSE | nMAE | nRMSE | Directional acc. |
| --- | ---: | ---: | ---: | ---: | ---: |
| Naive previous-close baseline | 4.4590 | 6.8681 | 0.0072 | 0.0111 | 0.0000 |
| Google TimesFM 2.5 | 4.5301 | 7.1305 | 0.0073 | 0.0115 | 0.5760 |
| Amazon Chronos-2 | 4.8028 | 7.1883 | 0.0077 | 0.0116 | 0.5120 |

The naive baseline wins by test MAE; TimesFM is the best pretrained model. The
app ships TimesFM 2.5 because the project requires a real ML forecast, while the
naive baseline remains the reported benchmark comparison. Confirm with the
instructor whether the evaluation should present the winner, TimesFM, or both.
Full artifacts, bootstrap intervals, latency, memory, and the exact revisions are
under `experiments/results/spy_2015_2025/`. See `experiments/README.md` for
details.

## Roadmap

1. ~~Model proof of concept: pretrained inference + previous-close baseline, MAE/RMSE.~~
2. ~~Backend: inference pipeline behind `POST /predict`, persist prediction records.~~
3. ~~Frontend: three-stock selector, history chart, Predict Stock flow, evaluation panel.~~
4. ~~Docs, evaluation charts, and clean-environment setup test.~~
5. Optional: prediction-history list or watchlist polish.

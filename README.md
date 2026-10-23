# Stock Predictor

A stock-tracking web app with an ML-powered next-day closing-price forecast.

- **Frontend:** React + TypeScript + Vite, Tailwind CSS, Recharts
- **Backend:** Python + FastAPI, Pydantic, SQLAlchemy 2 (PostgreSQL), Alembic
- **Market data:** `yfinance`
- **Model:** benchmarked foundation models (Chronos-2, TimesFM 2.5) and a naive
  baseline; see the benchmark section below

This is an academic demonstration. Forecasts are uncertain and are not
financial advice.

## Layout

```text
├── frontend/   # Vite + React + TypeScript SPA
├── backend/    # FastAPI app (routes, services, ml, db, schemas)
└── stock_predictor_handoff.md
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
| GET | `/api/stocks/{symbol}/history?period=1y` | real daily closes via yfinance |
| POST | `/api/stocks/{symbol}/predict` | returns 501 until model is wired |

Migrations: `uv run alembic revision --autogenerate -m "..."` then
`uv run alembic upgrade head` (requires a reachable PostgreSQL).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at http://localhost:5173 and proxies `/api` to the backend on port 8000.

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

The naive baseline wins by test MAE; TimesFM is the best pretrained model.
Because the app requires a real ML forecast, the baseline-vs-ML conflict must be
resolved with the instructor before wiring `/predict`. Full artifacts, bootstrap
intervals, latency, memory, and the exact revisions are under
`experiments/results/spy_2015_2025/`. See `experiments/README.md` for details.

## Roadmap

1. ~~Model proof of concept: pretrained inference + previous-close baseline, MAE/RMSE.~~
2. Backend: inference pipeline behind `POST /predict`, persist prediction records.
3. Frontend: three-stock selector, history chart, Predict Stock flow, evaluation panel.
4. Polish: evaluation charts, README, clean-environment setup test.

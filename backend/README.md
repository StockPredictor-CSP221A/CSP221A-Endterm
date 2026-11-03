# Backend (FastAPI)

Python API for the stock predictor. Requires Python 3.12+ and `uv`.

## Setup

```bash
cp .env.example .env
uv sync                 # base API; /predict returns 502 without model deps
uv sync --extra ml      # optional: run TimesFM locally
uv run uvicorn app.main:app --reload
```

## Structure

```text
app/
├── main.py          # FastAPI app, CORS, router wiring
├── config.py        # env-backed settings (pydantic-settings)
├── routes/          # HTTP endpoints (health, stocks)
├── services/        # market-data retrieval/validation
├── ml/              # inference, preprocessing, baselines
├── db/              # SQLAlchemy engine/session
├── db_models/       # SQLAlchemy table models
└── schemas/         # Pydantic API schemas
alembic/             # DB migrations (wired to app settings + metadata)
tests/               # pytest
```

## Commands

```bash
uv run pytest                 # tests
uv run ruff check .           # lint
uv run alembic upgrade head   # apply migrations (needs PostgreSQL)
```

## Model

`POST /api/stocks/{symbol}/predict` runs Google TimesFM 2.5:

- Checkpoint `google/timesfm-2.5-200m-pytorch`, revision
  `1d952420fba87f3c6dee4f240de0f1a0fbc790e3`, pinned in `app/ml/timesfm.py`.
- `app/ml/forecast.py` is pure prediction assembly (1,024-day context, one
  business-day horizon, validation); `app/ml/timesfm.py` is a lazy per-process
  singleton so weights load once per container.
- The route fetches five years of daily closes via `yfinance`, forecasts the next
  business day, and persists a `predictions` row before responding.
- Errors: 404 invalid symbol, 422 insufficient history, 502 provider/model
  failure, 503 persistence failure.
- The forecast date advances to the next weekday. Exchange holidays are not
  modeled (documented limitation).
- Production builds from `uv.lock` with `.uv_sync(extras=["ml"])`, so the
  benchmark pins (`torch==2.14.1`, `timesfm[torch]==3.0.2`, `numpy==2.5.4`,
  `pandas==3.0.6`) are reproduced.

Tests use a fake forecaster, so `uv sync` is enough for them. Install
`uv sync --extra ml` only when you need real inference locally.

## Deployment (Modal + Neon)

The live backend is a Modal ASGI app
(<https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run>).
`modal_app.py` builds a Python 3.12 image with `.uv_sync(extras=["ml"])` from
`uv.lock` (runtime + model deps match the lock), mounts the `app` package, and
returns the existing FastAPI app. The
`stock-predictor-hf-cache` volume is mounted at `/cache` with
`HF_HOME=/cache/huggingface`; the function uses `cpu=2`, `memory=4096`,
`timeout=600`, and `scaledown_window=60`. The Modal secret
`stock-predictor-api` supplies `DATABASE_URL` and `CORS_ORIGINS`.

Set `DATABASE_URL` to the Neon **pooled** connection string (keep
`?sslmode=require`), then apply the schema:

```bash
uv run alembic upgrade head
```

Deploy:

```bash
uv tool install modal          # once
modal setup                    # browser auth, once
modal secret create stock-predictor-api --force \
  DATABASE_URL='postgresql+psycopg://...neon.tech/neondb?sslmode=require' \
  'CORS_ORIGINS=["https://stock-predictor-omega-five.vercel.app"]'
modal deploy modal_app.py
modal app rollover stock-predictor-api   # after changing a secret
```

Verify with `/api/health`, `/api/health/db`,
`/api/stocks/NVDA/history?period=1mo`, and
`POST /api/stocks/SPY/predict`. The first prediction after a deploy reloads the
model (about 30–50 s); warm calls are about 7 s.

### Optional: Docker / Hugging Face

The Dockerfile remains for local use or another host:

```bash
docker build -t stock-api .
docker run --env-file .env -p 7860:7860 stock-api
```

Hugging Face Docker Spaces now require PRO on free accounts, and free ZeroGPU
Spaces require an account at least 30 days old. If you later use a Docker Space,
add this frontmatter to a copy of this README:

```yaml
---
title: Stock Predictor API
sdk: docker
app_port: 7860
---
```

The image installs the base deps plus the `ml` extra, so `/predict` works. It is
large because torch pulls CUDA libraries even on CPU-only hosts. Set
`HF_HOME` (defaults to `/home/appuser/.cache/huggingface`) to persist weights
across container restarts.

## Conventions

- Never fabricate market data or predictions; surface provider/model errors.
- Market-data and model failures map to `502`; unknown/invalid tickers map to
  `404`; too little history maps to `422`; DB persistence failure maps to `503`.
- Read all credentials from environment variables; never commit `.env`.

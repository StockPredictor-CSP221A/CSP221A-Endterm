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
├── core/            # password hashing, JWT, auth dependency
├── routes/          # HTTP endpoints (health, auth, stocks, predictions, watchlist)
├── services/        # market data, universe metadata, news normalization/cache
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

## Authentication

Email/password accounts live in the `users` table. Passwords are hashed with
Argon2 (`pwdlib`); sessions are stateless HS256 JWT bearer tokens with `sub`
(user id), `iat`, and `exp` claims.

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | public | `{email, password, display_name?}`; password ≥ 8 chars; email lowercased; `409` if taken |
| `POST` | `/api/auth/login` | public | `{email, password}`; `401` with a generic message on bad credentials |
| `GET` | `/api/auth/me` | bearer | `{id, email, display_name, created_at}` |
| `POST` | `/api/auth/logout` | public | `204`; the client discards its token |

Register and login return `{access_token, token_type: "bearer", user}`.
Protected endpoints answer `401` with `WWW-Authenticate: Bearer` when the token
is missing, malformed, expired, or belongs to a deleted user.

Settings (see `.env.example`):

- `JWT_SECRET` — required in every shared environment (Modal secret
  `stock-predictor-api`). Generate one with
  `python -c "import secrets; print(secrets.token_urlsafe(64))"`. If unset, the
  app signs with a random per-process key and logs a warning, so sessions do not
  survive restarts.
- `JWT_ALGORITHM` — default `HS256`.
- `ACCESS_TOKEN_EXPIRE_MINUTES` — default `10080` (7 days).

Tests run against an in-memory SQLite database through a `get_db` dependency
override (`tests/conftest.py`); they never touch Neon.

## Data endpoints

All require a bearer token. Symbols outside `SPY`, `NVDA`, `KO` return `404`.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/stocks` | symbol, name, role, description for the fixed universe |
| `GET` | `/api/stocks/{symbol}/history?period=1y` | `period` in `5d, 1mo, 3mo, 6mo, ytd, 1y, 2y, 5y` (else `422`) |
| `POST` | `/api/stocks/{symbol}/predict` | TimesFM forecast saved with the caller's `user_id` |
| `GET` | `/api/stocks/{symbol}/news?limit=4` | `limit` 1–10; normalized yfinance headlines, cached 10 min; `[]` on any provider failure |
| `GET` | `/api/predictions?symbol=&limit=20` | caller's forecasts only, newest first; `limit` 1–100 |
| `GET` | `/api/watchlist` | caller's symbols with metadata and `added_at` |
| `POST` | `/api/watchlist/{symbol}` | idempotent add |
| `DELETE` | `/api/watchlist/{symbol}` | idempotent remove, `204` |

## Migrations

| Revision | Change |
| --- | --- |
| `0001` | `predictions` |
| `0002` | `users` (unique lowercase email) |
| `0003` | nullable `predictions.user_id` → `users.id` `ON DELETE SET NULL`, indexed; existing rows keep `NULL` |
| `0004` | `watchlist_items` (`user_id` → `users.id` `ON DELETE CASCADE`, unique `(user_id, symbol)`) |

Apply with `uv run alembic upgrade head` against the target database before
deploying code that needs the new tables. All four upgrade and downgrade
cleanly on PostgreSQL.

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
`stock-predictor-api` supplies `DATABASE_URL`, `CORS_ORIGINS`, and
`JWT_SECRET`.

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
  'CORS_ORIGINS=["https://stock-predictor-omega-five.vercel.app"]' \
  JWT_SECRET='<long random string>'
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

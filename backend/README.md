# Backend (FastAPI)

Python API for the stock predictor. Requires Python 3.12+ and `uv`.

## Setup

```bash
cp .env.example .env
uv sync
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

## Conventions

- Never fabricate market data or predictions; surface provider/model errors.
- Market-data failures map to `502`; unknown/invalid tickers map to `404`.
- Read all credentials from environment variables; never commit `.env`.

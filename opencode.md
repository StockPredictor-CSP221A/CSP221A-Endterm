# Stock Predictor — Project Brief

Academic project, four weekly sprints. Build an original stock-tracking web app
whose **Predict Stock** action returns a real ML forecast. This is a demo, not a
trading system; forecasts are uncertain and are not financial advice.

## 1. Scope

- **Frontend:** React + TypeScript (Vite).
- **Backend:** Python + FastAPI.
- **Prediction:** exactly **one value** — next trading day's **close** (or open;
  pick one and document it). One-day horizon only. No multi-day or multi-stock
  sequence forecasts.
- **Universe:** exactly **three fixed stocks**. No arbitrary ticker search.
- **Model:** real pretrained/trained model with measured evaluation. No
  hardcoded or random forecasts.
- **Benchmark:** compare **three distinct models** on identical data, splits, and
  metrics; ship the winner with a documented justification.
- **Originality:** do not copy or reskin the reference tutorial
  (https://github.com/adrianhajdin/signalist_stock-tracker-app). It is product
  inspiration only.
- Confirm with the instructor whether grading covers the model, the full app, or
  both, and whether fine-tuning is mandatory.

## 2. Fixed stock universe

Pick one stock per role, with a shared daily date range.

| Slot | Role | Locked symbol |
| --- | --- | --- |
| 1 | Safe / low volatility | `SPY` (locked benchmark asset) |
| 2 | Volatile | `NVDA` |
| 3 | Defensive / contrasting regime | `KO` |

Prefer liquid ETFs and large caps so `yfinance` data is complete. The universe
and date range are fixed for the whole project and recorded with results.
Backend enforcement: `SUPPORTED_SYMBOLS = ("SPY", "NVDA", "KO")` in
`app/services/market_data.py`; other tickers return 404.

The current foundation-model benchmark is run on **SPY only**; the shipped app
uses the three locked stocks above.

## 3. Tech stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS, Recharts.
- **Backend:** FastAPI, Pydantic, Uvicorn.
- **Data/ML:** pandas, NumPy, scikit-learn, Hugging Face ecosystem, PyTorch as
  required, `yfinance` (MVP) or Finnhub (check limits first). Use one provider.
- **Database:** PostgreSQL, SQLAlchemy 2.x, psycopg 3, Alembic. Keep raw
  experiment output in CSV/Parquet. Read `DATABASE_URL` from env; commit only
  `.env.example`.
- **Tooling:** `uv` for Python, npm for Node, Git/GitHub, Google Colab if local
  inference is too slow.
- **Deployment (live, free tier):** Vercel (frontend), Modal (FastAPI ASGI,
  serverless), Neon Postgres. See Section 15.
- **Do not add:** MongoDB, a Node backend, Redis, background jobs, or auth.

## 4. Architecture

```text
React + TypeScript (Vite)
        | HTTP
        v
FastAPI backend
        +--> PostgreSQL (cached prices, prediction history)
        +--> market-data provider
        +--> validation / preprocessing
        +--> selected forecasting model
        v
JSON response --> frontend charts, forecast, and evaluation panel
```

Run the model in the Python backend. Load it once; never download or fine-tune
on a user request.

## 5. Model benchmark (core requirement)

Ship the **best of three rows**, not the first one that runs.

### Candidate set (locked)

1. **Amazon Chronos-2** — `amazon/chronos-2`, revision
   `29ec3766d36d6f73f0696f85560a422f50e8498c`,
   `chronos-forecasting==2.3.2`, 120M parameters, zero-shot. Official repo:
   https://github.com/amazon-science/chronos-forecasting.
2. **Google TimesFM 2.5** — `google/timesfm-2.5-200m-pytorch`, revision
   `1d952420fba87f3c6dee4f240de0f1a0fbc790e3`, `timesfm==3.0.2`, 200M
   parameters, zero-shot.
3. **Naive baseline (required):** next close = previous close. This is the
   mandatory control and may count as one of the three.

This gives three benchmark rows. If the rubric requires three *non-baseline*
models, add a fourth row later; do not replace the baseline. Do not add
fine-tuning unless it beats the pretrained version and the baseline under the
same protocol.

### Locked benchmark asset and split

- Asset: **SPY**. The app universe remains three fixed stocks; SPY is the
  benchmark asset.
- Source: `yfinance`, daily bars, `auto_adjust=False`. Use unadjusted `Close`
  pending final confirmation; `Adj Close` is the documented alternative.
- Data range: 2015-01-02 to 2025-12-31 (2,766 rows).
- Train/fit range: 2015-01-02 to 2023-12-29 (2,264 rows). Zero-shot models do
  not update weights; this is the history available before validation.
- Validation range: 2024-01-02 to 2024-12-31 (252 rows). Sanity check only.
- Test range: 2025-01-02 to 2025-12-31 (250 rows). Final numbers only.
- Input window: last **1,024** trading-day closes.
- Horizon: **1 trading day**.
- Forecast statistic: median (`q=0.5`).
- No covariates, no cross-learning, no fine-tuning.

### Protocol (identical for every model)

- Same symbol, dates, target `Close(t)`, context length, horizon, and
  preprocessing.
- For each prediction date `t`, use only
  `Close(t-1024) ... Close(t-1)`. Never include `Close(t)` or future values.
- Roll the context forward one trading day at a time over the test period.
- No fitting on validation or test data. Foundation models are zero-shot; the
  naive baseline has no parameters.
- Validation is used only to catch implementation errors; run test once for the
  final numbers.
- Clean data by sorting by date, dropping duplicates, dropping rows with
  missing/non-positive close, and not interpolating.
- Report per-asset and pooled results. With one benchmark asset, pooled equals
  SPY; keep the schema ready for more assets.
- Include the naive baseline in every comparison table.
- Save raw predictions and metrics to `experiments/results/`.

### Metrics

Primary: **MAE** and **RMSE**. Also report normalized MAE and RMSE
(`MAE / mean(test close)`, `RMSE / mean(test close)`) and directional accuracy.
Optional: moving-block bootstrap 95% confidence intervals.

### Runtime and memory

Record on the same hardware for both foundation models:

- Hardware, OS, Python, package versions, torch thread count, git commit.
- Model load time with a warm Hugging Face cache; TimesFM setup/compile time
  separately.
- 3 warm-up forecasts excluded; per-forecast latency (mean, median, p95) over
  all 250 test origins, plus total inference time.
- Peak RSS baseline, after load, during inference, and delta, measured in a
  fresh subprocess with `psutil`; also record `ru_maxrss`.
- Training time: 0 seconds, `training_regime="zero_shot"`.

### Hyperparameters

**Chronos-2**

- `context_length=1024`, `prediction_length=1`, median (`q=0.5`)
- `batch_size=1` for latency, `device=cpu`, `dtype=float32`, 8 threads
- No covariates, no cross-learning, no fine-tuning

**TimesFM 2.5**

- `max_context=1024`, `horizon=1`, median (`q=0.5`)
- `normalize_inputs=True`, `use_continuous_quantile_head=True`,
  `force_flip_invariance=True`, `infer_is_positive=True`,
  `fix_quantile_crossing=True`, `per_core_batch_size=1`,
  `torch_compile=False`
- `device=cpu`, `dtype=float32`, 8 threads
- No XReg covariates, no fine-tuning

**Naive baseline**

- `prediction(t) = Close(t-1)`.

### Feature definitions

- Target: `y_t = SPY Close_t` (unadjusted close; document if changed).
- Input: `[y_{t-1024}, ..., y_{t-1}]`, chronological, no gaps filled.
- No exogenous features, returns, technical indicators, or future covariates.
- Foundation models perform their own internal scaling; no dataset-level scaler
  is fitted.
- Record the exact data download timestamp and SHA-256 in a data manifest.

### Required artifacts

Save under `experiments/results/spy_2015_2025/<run_id>/`:

- `run_config.json`, `environment.json`, `data_manifest.json`
- `models/chronos2.json`, `models/timesfm.json`, `models/naive.json`
- `metrics.csv` (one row per model × asset)
- `predictions/<model>__SPY.csv`
- `summary.md`, optional plots and `run.log`

Each model JSON must record: model name, exact checkpoint, revision, checkpoint
file SHA-256, parameter count, checkpoint size, library version, input window,
horizon, train/validation/test ranges, hyperparameters, feature definitions,
training regime/time, load time, inference time, and memory use.

`metrics.csv` must include: model, checkpoint, revision, asset, split, n, MAE,
RMSE, nMAE, nRMSE, directional accuracy, train/val/test date ranges, context
length, horizon, training time, load time, total inference time, per-forecast
latency statistics, and peak RSS.

### Selection rule

Pick the lowest test MAE; use RMSE, inference time, and memory as tie-breakers.
Check consistency across assets once the universe expands. Include the naive
baseline. If the most accurate model is impractical for the API, document the
trade-off and ship the best feasible model. Store the winning model/version,
benchmark CSV, split dates, and metrics; show the comparison in the app.

## 6. ML correctness

- One target only: next-day close **or** next-day open, documented and used by
  every model.
- Sort by date and handle missing/invalid rows deliberately.
- No look-ahead: only past observations in features and model context.
- No fitting preprocessing on validation/test data.
- Compare against the baseline and state the evaluation period and method.
- Do not claim accuracy without measured evidence. Historical metrics do not
  guarantee an individual future forecast.
- Only show prediction intervals if the chosen model genuinely supports them.
- Forecast dates advance over weekends only; exchange holidays are **not**
  modeled. This is a documented limitation of `next_business_day()`.

## 7. Feature scope

**Must have**

1. Select one of the three supported stocks.
2. Historical daily closing-price chart.
3. **Predict Stock** button with idle/loading/success/error states.
4. Backend fetches, validates, and prepares live historical data.
5. Real inference returns one next-day forecast.
6. Show predicted close, forecast date/horizon, and latest observed close/date.
7. Show model-vs-baseline evaluation with the test period and methodology.
8. Graceful handling of bad symbols, missing data, provider outages, and model
   errors.
9. Document data source, model, evaluation, and limitations.

**Nice to have:** watchlist, actual-vs-predicted chart, prediction history,
deployment, correctly implemented prediction intervals.

**Avoid initially:** auth, payments, news summaries, alerts/background jobs,
portfolio management, real-time streaming, multiple data providers, large
database architecture.

## 8. API

- `GET /api/stocks/{symbol}/history` — validated daily prices for one supported
  symbol.
- `POST /api/stocks/{symbol}/predict` — runs inference and returns symbol,
  horizon, last observed date/close, forecast date/close, model name, and
  disclaimer.
- `GET /api/evaluation` (optional but useful) — benchmark table and test period.

Behavior:

- Reject anything outside the three-stock whitelist with a clear error.
- Use timeouts and meaningful errors; never fabricate prices.
- Cache history in PostgreSQL with source/timestamp; persist predictions if
  history is in scope.
- Manage schema with Alembic; never edit production tables by hand.
- Keep the model out of the request path for training/fine-tuning.
- Configure CORS for local frontend development.

## 9. Frontend layout

Original, simple dashboard: header, three-stock selector with role labels,
latest close/date summary, historical chart, prediction panel, forecast result,
evaluation comparison, and methodology/disclaimer. Visually distinguish
observed history from predictions.

## 10. Sprint plan

**Week 1 — Data + model proof of concept.** Repo, environment, historical data,
model card verification, Chronos-2 and TimesFM 2.5 zero-shot inference, naive
baseline, three-row benchmark (Section 5), chronological MAE/RMSE, runtime, and
memory. Fine-tuning is out of scope unless it beats the zero-shot models and
baseline later.

**Week 2 — Backend.** FastAPI app, PostgreSQL config + initial migration,
history retrieval/cache, separated preprocessing/inference/evaluation modules,
history and predict endpoints, CORS, tests, prediction persistence.

**Week 3 — Frontend.** Vite app, stock selector, summary, history chart, API
integration, Predict Stock flow with all states, clear forecast display.

**Week 4 — Evaluation + polish.** Final out-of-sample benchmark, selected model,
error handling, README, clean-environment setup test, actual-vs-predicted chart
if time, demo.

## 11. Project structure

```text
stock-predictor/
├── frontend/                 # Vite + React + TypeScript
│   └── src/{components,pages,services,types}
├── backend/
│   ├── app/{routes,services,data,ml,db,db_models,schemas}
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── experiments/              # benchmark/evaluation scripts + results
│   ├── configs/              # benchmark YAML/JSON configs
│   ├── src/benchmark/        # data, splits, models, metrics, runner
│   ├── tests/                # no-look-ahead and metric tests
│   └── results/              # metrics.csv, predictions, model JSON, summary
├── data/                     # local/cache only; do not commit large files
└── README.md
```

Simplify when a directory is not yet needed.

## 12. Definition of done

- [x] React + TypeScript frontend limited to the three fixed stocks.
- [x] One documented prediction target and one-day horizon (unadjusted `Close`;
      next weekday; exchange holidays not modeled).
- [x] Real, documented market-data source (`yfinance`, unadjusted daily closes).
- [x] PostgreSQL configured by env vars; schema managed by migrations.
- [x] Free-tier deployment connected: Vercel frontend, Modal FastAPI, Neon
      Postgres; `GET /api/health/db` passes.
- [x] Predict Stock calls the Python API and uses a real model (TimesFM 2.5).
- [x] Three benchmark rows (Chronos-2, TimesFM 2.5, naive baseline) run on SPY
      under one chronological protocol; TimesFM ships as the best pretrained
      model, naive remains the MAE winner, and the trade-off is documented.
- [x] Benchmark artifacts saved under `experiments/results/` with exact
      checkpoints, splits, features, metrics, runtime, and memory.
- [x] Forecast date/horizon and latest observed close are shown.
- [x] Invalid symbols, provider failures, and model errors handled.
- [x] Chronological holdout and naive baseline included.
- [x] MAE/RMSE and limitations reported honestly.
- [x] README covers setup, frontend/backend commands, data/model sources,
      evaluation, and limitations.
- [ ] Implementation is original (student attestation).

## 13. Current implementation status

- **Frontend:** Vite + React 19 + TypeScript SPA; Tailwind CSS v4 and Recharts.
  Three-stock selector (`SPY`, `NVDA`, `KO`), 1M/6M/1Y/5Y history chart, latest
  close/date summary, Predict Stock idle/loading/success/error states, dashed
  forecast segment, and a benchmark table. Typed client in
  `src/services/api.ts` with JSON `detail` extraction; `/api` proxied to port
  8000 in dev. Components live under `src/components/`, universe/benchmark data
  under `src/data/`.
- **Backend:** FastAPI with `uv` (Python 3.12). `GET /api/health`,
  `GET /api/health/db` (Neon connectivity check),
  `GET /api/stocks/{symbol}/history` (real `yfinance` data), and
  `POST /api/stocks/{symbol}/predict` (live TimesFM forecast + DB persistence).
  History and predict accept only `SPY`, `NVDA`, and `KO`; other symbols return
  404. Predictions fetch five years of daily closes, use the last 1,024
  observations, forecast one business day ahead, and persist a `predictions`
  row. Errors map to 404 (bad/unsupported symbol), 422 (short
  history), 502 (provider/model), and 503 (persistence). SQLAlchemy 2 + psycopg 3
  + Alembic configured, with the initial `predictions` migration applied to Neon
  (`0001 (head)`). Database URLs are normalized to `psycopg` 3. Naive
  previous-close baseline remains in `app/ml/baseline.py` for benchmark parity.
  Tests and ruff pass; `.env.example` provided.
- **Model (live):** Google TimesFM 2.5, checkpoint
  `google/timesfm-2.5-200m-pytorch`, revision
  `1d952420fba87f3c6dee4f240de0f1a0fbc790e3`, loaded once per Modal container.
  Code: `app/ml/forecast.py` (pure prediction assembly, business-day logic) and
  `app/ml/timesfm.py` (lazy singleton). The Modal image builds from `uv.lock`
  with `.uv_sync(extras=["ml"])`, reproducing the benchmark pins
  (`torch==2.14.1`, `timesfm[torch]==3.0.2`, `numpy==2.5.4`,
  `pandas==3.0.6`) and mounts the `stock-predictor-hf-cache` volume at `/cache`
  with `HF_HOME=/cache/huggingface`. Local model use is optional:
  `uv sync --extra ml`.
- **Deployment (live):** Vercel frontend
  (<https://stock-predictor-omega-five.vercel.app>), Modal FastAPI
  (<https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run>), Neon
  Postgres. `/api/health`, `/api/health/db`,
  `/api/stocks/NVDA/history?period=1mo`, and
  `POST /api/stocks/SPY/predict` return 200; CORS allows the Vercel origin. The
  Vercel production bundle points at the Modal API and ships the three-stock UI.
  `backend/modal_app.py` deploys the ASGI app; the Modal secret
  `stock-predictor-api` holds `DATABASE_URL` and `CORS_ORIGINS`.
  `backend/Dockerfile` remains for local/alternate hosts. CI and a manual Modal
  deploy workflow are in place.
- **Benchmark (done):** locked Section 5 protocol implemented as an isolated
  `uv` project in `experiments/`. SPY, 2015-01-02 to 2025-12-31; unadjusted
  `Close`; 1,024-day past-only context; one-day horizon; Chronos-2 and TimesFM
  2.5 zero-shot; naive previous-close baseline. Validation and the one-shot 2025
  test pass ran on CPU (8 threads) with warm HF cache. 2025 test MAE: naive
  4.4590, TimesFM 4.5301, Chronos-2 4.8028. The locked rule selects the naive
  baseline; TimesFM is the best pretrained model (1.59% higher MAE).
  Artifacts: `experiments/results/spy_2015_2025/test_20261020T134507Z/` and
  `validation_20261020T134352Z/`.
- **Benchmark-vs-app choice:** the app ships TimesFM 2.5 (best pretrained model,
  1.59% higher MAE than naive), while the naive baseline remains the reported
  benchmark winner. This is a documented trade-off because the app requires a
  real ML forecast; confirm with the instructor whether the evaluation should
  present only the winner, only TimesFM, or both.
- **Open decisions:** rubric confirmation; final benchmark-vs-app presentation;
  whether to add optional prediction history/watchlist polish.
- **Done:** clean-environment setup test passed (backend `uv sync --frozen` +
  ruff + 21 tests; frontend `npm ci` + lint + build). **Not done:** optional UI
  polish only.

## 14. Immediate next steps

1. Add the `VERCEL_TOKEN` Actions secret, or connect native Vercel Git after the
   org installs the Vercel GitHub App. Remove `deploy-frontend.yml` once native
   deploys work.
2. Confirm the benchmark-vs-app presentation with the instructor (the app
   currently ships TimesFM 2.5; naive wins MAE).
3. Optional polish: prediction-history list, watchlist, or actual-vs-predicted
   chart. Do not add scope without time.
4. Re-run `scripts/smoke.sh` and CI after each backend change; redeploy Vercel
   after frontend changes.

**Priority:** confirm evaluation story → Vercel native/secret → optional polish.
Fine-tuning remains out of scope unless it beats the pretrained models and
baseline under the same protocol.

## 15. Deployment (live, free tier)

The app is deployed:

| Layer | Service | URL |
| --- | --- | --- |
| Frontend | Vercel Hobby | <https://stock-predictor-omega-five.vercel.app> |
| Backend | Modal Starter | <https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run> |
| Database | Neon Free | pooled PostgreSQL (project `ep-jolly-paper-b5q6o7ti`) |

Verified 2026-11-01: `/api/health` 200, `/api/health/db` 200 (`postgresql`),
`/api/stocks/NVDA/history?period=1mo` 200, `AAPL` history/predict 404
(universe enforced), CORS preflight allowed from the Vercel origin, and
`POST /api/stocks/SPY/predict` 200 with a persisted `predictions` row. The
Vercel production bundle points at the Modal API and includes `SPY`, `NVDA`, and
`KO`.

### Why Modal rather than Hugging Face Spaces

Hugging Face rejects Docker Spaces on free accounts with `402 Payment Required`
(PRO required), and free ZeroGPU Spaces require an account at least 30 days old.
The `mikledez` account is free and new, so both paths were blocked. Modal's
Starter plan includes $30/month of compute with no monthly fee; it scales to
zero and serves a FastAPI ASGI app directly.

Docker is no longer the deployed packaging format, but `backend/Dockerfile`
remains for local use or another host. Do **not** deploy FastAPI to Vercel.

### Data flow

```text
Vercel (React) --HTTPS--> Modal (FastAPI ASGI) --psycopg 3--> Neon Postgres
                              |
                              +--> yfinance
                              +--> Google TimesFM 2.5 (Modal CPU)
```

- Frontend to backend:
  `VITE_API_BASE=https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run/api`.
- Backend to frontend:
  `CORS_ORIGINS=["https://stock-predictor-omega-five.vercel.app"]`.
- Backend to database: `DATABASE_URL` (Neon pooled, keep `?sslmode=require`).
  The app rewrites `postgres://`/`postgresql://` to `postgresql+psycopg://`.
- Schema: `uv run alembic upgrade head` applied `predictions`
  (`alembic/versions/0001_create_predictions.py`); `alembic current` is
  `0001 (head)`.

### Backend deployment (Modal)

`backend/modal_app.py` defines `modal.App("stock-predictor-api")`, a Python 3.12
image built with `.uv_sync(extras=["ml"])` from `uv.lock` (so runtime and model
deps match the benchmark pins), `add_local_python_source("app")`, and
`@modal.asgi_app()` returning the existing FastAPI app. The
`stock-predictor-hf-cache` volume is mounted at `/cache` with
`HF_HOME=/cache/huggingface`, so model weights survive container restarts.
The function runs with `cpu=2`, `memory=4096`, `timeout=600`, and
`scaledown_window=60`. Secrets are injected from the Modal secret
`stock-predictor-api`.

Model runtime: the first request after a deploy reloads TimesFM into the
container (about 30–50 s); warm predictions are about 7 s. Inference is
deterministic for the same input and pinned environment. Predictions are written
to Neon before the response is returned.

```bash
cd backend
uv tool install modal          # once
modal setup                    # browser auth, once

modal secret create stock-predictor-api --force \
  DATABASE_URL='postgresql+psycopg://...neon.tech/neondb?sslmode=require' \
  'CORS_ORIGINS=["https://stock-predictor-omega-five.vercel.app"]'

modal deploy modal_app.py
modal app rollover stock-predictor-api   # after changing a secret
```

`modal deploy` uploads the working tree, so commit first for reproducibility.
The deploy prints the web endpoint; the current one is in the table above.

### Frontend deployment (Vercel)

The project is `mikkel13/stock-predictor` (Vercel scope `mikkel13`), Root
Directory `frontend`, framework Vite. Production env:
`VITE_API_BASE=https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run/api`.

The repo is public but lives under the `StockPredictor-CSP221A` GitHub org, and
the Vercel GitHub App is not installed there, so native Git integration fails
(`vercel git connect` returns "Failed to connect"). Do **not** retry the app
install unless an org owner can grant it. Auto-deploy instead runs through
`.github/workflows/deploy-frontend.yml` on pushes to `main` or
`feature/benchmarking`, plus manual dispatch.

Required secret: `VERCEL_TOKEN` (Vercel account token scoped to `mikkel13`). If
you cannot add secrets to the class repo, fork the public repo to your account
and add the secret to the fork; the workflow file comes with the fork.

```bash
# Manual deploy: run from the repo root, not frontend/
cd <repo-root>
VERCEL_ORG_ID=team_EaEujHq5CUZvuHjXAzEEXjap \
VERCEL_PROJECT_ID=prj_xhcxU3f4Av5NesiNEqcNSr3poErr \
vercel --prod --yes
```

Running `vercel` from `frontend/` now double-nests (`frontend/frontend`) because
the project Root Directory is already `frontend`.

### CORS loop

After changing the frontend origin, update the Modal secret and roll the app:

```bash
modal secret create stock-predictor-api --force \
  DATABASE_URL='...' \
  'CORS_ORIGINS=["http://localhost:5173","https://<frontend-host>"]'
modal app rollover stock-predictor-api
```

A secret update alone does not restart warm containers. If a rollover still
serves the old value, run
`modal app stop stock-predictor-api -y && modal deploy modal_app.py --strategy recreate`.
This is the pattern that worked after adding the Vercel origin.

### Free-tier limits to watch

- **Modal Starter:** $30/month compute, 100 containers, 10 GPU concurrency, 8
  web endpoints, 1-day log retention, no custom domain. Scale-to-zero; the first
  request after idle reloads TimesFM from the `stock-predictor-hf-cache` volume
  (about 30–50 s), then warm calls are about 7 s.
- **Neon Free:** scale-to-zero, 6 h PITR and one manual snapshot; use the pooled
  URL for the app. Do not poll `/api/health/db` frequently.
- **Vercel Hobby:** static SPA only; no Python. Preview deployments have
  different origins and need to be added to `CORS_ORIGINS` if used.

### Automation

- `.github/workflows/ci_pipeline.yml` - backend `ruff`/`pytest` and frontend
  lint/build on every push and pull request.
- `.github/workflows/deploy-backend.yml` - manual Modal deploy. Add repository
  secrets `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (from the Modal dashboard or
  `~/.modal.toml`).
- `.github/workflows/deploy-frontend.yml` - Vercel production deploy on pushes to
  `main`/`feature/benchmarking` (and manual dispatch). Add repository secret
  `VERCEL_TOKEN`. The workflow runs from the repo root so the project Root
  Directory `frontend` is applied correctly.
- `scripts/deploy-backend.sh` - local `modal deploy`.
- `scripts/smoke.sh` - health, database, sample history, and live predict checks.

### Required environment variables

| Variable | Where | Kind | Example |
| --- | --- | --- | --- |
| `DATABASE_URL` | Modal secret | secret | `postgresql+psycopg://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require` |
| `CORS_ORIGINS` | Modal secret | config | `["https://stock-predictor-omega-five.vercel.app"]` |
| `VITE_API_BASE` | Vercel | env var | `https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run/api` |

Never commit the Neon URL or Modal tokens. Local development still uses
`http://localhost:5173` -> Vite proxy -> `http://localhost:8000`;
`backend/.env.example` and `frontend/.env.example` record the templates.

### Deployment files

- `backend/modal_app.py` - Modal app, image, model volume, secret, ASGI
  entrypoint.
- `backend/alembic/versions/0001_create_predictions.py` - initial schema.
- `backend/Dockerfile`, `backend/.dockerignore` - optional local/alternate host.
- `frontend/vercel.json`, `frontend/.env.example` - Vercel build and API base.
- `.github/workflows/ci_pipeline.yml`, `.github/workflows/deploy-backend.yml`,
  `.github/workflows/deploy-frontend.yml` - CI, manual Modal deploy, and
  push-to-production Vercel deploy.
- `scripts/deploy-backend.sh`, `scripts/smoke.sh` - local deploy and smoke test.
- `GET /api/health/db` - verifies Neon connectivity without exposing
  credentials.

### Model on Modal (done)

The Modal image installs the pinned model stack (`torch==2.14.1`,
`timesfm[torch]==3.0.2`, `numpy==2.5.4`, `pandas==3.0.6`,
`huggingface-hub==2.2.0`) and mounts `stock-predictor-hf-cache` at `/cache`
(`HF_HOME=/cache/huggingface`). It runs on CPU (`cpu=2`, `memory=4096`,
`timeout=600`). `POST /api/stocks/{symbol}/predict` fetches five years of daily
closes, loads the lazy TimesFM singleton once per container, forecasts the next
business day, persists the row, and returns it. The naive baseline remains for
benchmark comparison. The first call after a deploy reloads weights (~30–50 s);
warm calls are ~7 s.

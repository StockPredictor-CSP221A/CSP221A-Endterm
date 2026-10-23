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

| Slot | Role | Candidates |
| --- | --- | --- |
| 1 | Safe / low volatility | `SPY` (locked benchmark asset) |
| 2 | Volatile | `TSLA`, `NVDA`, or `COIN` |
| 3 | Contrasting regime (TBD) | `KO`/`JNJ`/`PG` (defensive), `XOM`/`FCX` (cyclical), `EEM`/`FXI`/`EWJ` (international), `JPM`/`XLF` (financial), `GLD`/`BTC-USD` (other asset) |

Prefer liquid ETFs and large caps so `yfinance` data is complete. The universe
and date range are fixed for the whole project and recorded with results.

The current foundation-model benchmark is run on **SPY only**; the shipped app
still uses three fixed stocks. The other two app slots remain open.

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
- **Do not add:** MongoDB, a Node backend, Redis, background jobs, auth, or
  deployment unless required.

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

- [ ] React + TypeScript frontend limited to the three fixed stocks.
- [ ] One documented prediction target and one-day horizon.
- [ ] Real, documented market-data source.
- [ ] PostgreSQL configured by env vars; schema managed by migrations.
- [ ] Predict Stock calls the Python API and uses a real model.
- [ ] Three benchmark rows (Chronos-2, TimesFM 2.5, naive baseline) run on SPY
      under one chronological protocol; winner selected and justified.
- [ ] Benchmark artifacts saved under `experiments/results/` with exact
      checkpoints, splits, features, metrics, runtime, and memory.
- [ ] Forecast date/horizon and latest observed close are shown.
- [ ] Invalid symbols, provider failures, and model errors handled.
- [ ] Chronological holdout and naive baseline included.
- [ ] MAE/RMSE and limitations reported honestly.
- [ ] README covers setup, frontend/backend commands, data/model sources,
      evaluation, and limitations.
- [ ] Implementation is original.

## 13. Current implementation status

- **Frontend:** Vite + React 19 + TypeScript SPA; Tailwind CSS v4 and Recharts
  installed; typed API client in `src/services/api.ts`; `/api` proxied to port
  8000; `App.tsx` is a placeholder that calls `/api/health`.
- **Backend:** FastAPI with `uv` (Python 3.12). `GET /api/health`,
  `GET /api/stocks/{symbol}/history` (real `yfinance` data),
  `POST /api/stocks/{symbol}/predict` (returns **501**). History accepts any
  symbol (needs whitelist). SQLAlchemy 2 + psycopg 3 + Alembic configured; no
  migrations run. Naive previous-close baseline in `app/ml/baseline.py`. Tests
  and ruff pass; `.env.example` provided.
- **Benchmark (done):** locked Section 5 protocol implemented as an isolated
  `uv` project in `experiments/`. SPY, 2015-01-02 to 2025-12-31; unadjusted
  `Close`; 1,024-day past-only context; one-day horizon; Chronos-2 and TimesFM
  2.5 zero-shot; naive previous-close baseline. Validation and the one-shot 2025
  test pass ran on CPU (8 threads) with warm HF cache. 2025 test MAE: naive
  4.4590, TimesFM 4.5301, Chronos-2 4.8028. The locked rule selects the naive
  baseline; TimesFM is the best pretrained model (1.59% higher MAE).
  Artifacts: `experiments/results/spy_2015_2025/test_20261020T134507Z/` and
  `validation_20261020T134352Z/`.
- **Open decisions:** third app stock; close vs. open for the app; rubric
  confirmation; baseline-vs-ML conflict (benchmark winner is naive, but the app
  requires a real ML forecast).
- **Not done:** inference behind `/predict`, three-stock whitelist, PostgreSQL
  schema/migrations, full UI, final app README/evaluation panel.

## 14. Immediate next steps

1. Resolve the baseline-vs-ML conflict with the instructor: ship the benchmark
   winner (naive), ship the best pretrained model (TimesFM), or document a
   separate selection rule. Confirm the third app stock and app target.
2. Wire the selected inference into `POST /api/stocks/{symbol}/predict`, add the
   three-stock whitelist, and load the model once at startup.
3. Add PostgreSQL prediction persistence and Alembic migrations.
4. Build the three-stock frontend with history chart, predict states, and the
   evaluation comparison panel.
5. Finish the app README evaluation section and run a clean-environment setup
   test.

**Priority:** resolve model choice → wire working forecast → valid app
evaluation → API → usable UI → polish. Fine-tuning remains out of scope unless
it beats the pretrained models and baseline under the same protocol.

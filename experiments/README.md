# SPY benchmark harness

Isolated `uv` project for the locked Section 5 benchmark: three models on SPY,
2015-01-02 to 2025-12-31, with one shared chronological protocol.

## Locked protocol

- Target: next trading day's unadjusted `Close` (yfinance, `auto_adjust=False`).
- Input: the last 1,024 past closes only, rolled forward one trading day.
- Horizon: 1. Forecast statistic: median (`q=0.5`).
- Models: `amazon/chronos-2` (revision `29ec37...`), `google/timesfm-2.5-200m-pytorch`
  (revision `1d9524...`), and the naive previous-close baseline.
- Train/validation/test: 2015-01-02 to 2023-12-29, 2024, 2025 (one-shot test).
- No covariates, cross-learning, fine-tuning, or dataset-level scaling.
- CPU, `float32`, 8 torch threads.

The full machine-readable protocol is `configs/benchmark_spy.json`.

## Run

```bash
cd experiments
uv sync
uv run pytest
uv run ruff check .

# Validation is a sanity check only.
uv run python run_benchmark.py --split validation

# One-shot final test pass.
uv run python run_benchmark.py --split test
```

`run_benchmark.py` prefetches both checkpoints with exact revisions, then runs
each model in a fresh subprocess. Data is cached at `../data/` (ignored by git);
results are written to `results/spy_2015_2025/<split>_<UTC timestamp>/`. Every
invocation creates a new timestamped directory, so a reproduction run does not
overwrite the committed one-shot test result.

## Test results

| Model | MAE | RMSE | nMAE | nRMSE | Directional acc. |
| --- | ---: | ---: | ---: | ---: | ---: |
| Naive previous-close baseline | 4.4590 | 6.8681 | 0.0072 | 0.0111 | 0.0000 |
| Google TimesFM 2.5 | 4.5301 | 7.1305 | 0.0073 | 0.0115 | 0.5760 |
| Amazon Chronos-2 | 4.8028 | 7.1883 | 0.0077 | 0.0116 | 0.5120 |

Test period: 2025-01-02 to 2025-12-31, n=250. See
`results/spy_2015_2025/test_20261020T134507Z/summary.md` for bootstrap intervals,
latency, memory, and the selection discussion.

The locked rule selects the naive baseline by test MAE. TimesFM is the best
pretrained model (1.59% higher MAE). The app requires a real ML forecast, so the
project must resolve this baseline-vs-ML conflict with the instructor; the
benchmark result itself is not changed.

## Artifacts

Each run directory contains `run_config.json`, `environment.json`,
`data_manifest.json`, `models/<model>.json`, `metrics.csv`,
`predictions/<model>__SPY.csv`, `summary.md`, `plots/actual_vs_predicted.png`,
and `run.log`. The data manifest records the download timestamp and SHA-256 for
the raw and cleaned CSVs.

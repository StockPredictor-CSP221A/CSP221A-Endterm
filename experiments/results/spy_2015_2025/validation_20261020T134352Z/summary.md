# SPY foundation-model benchmark

- Run id: `validation_20261020T134352Z`
- Split: **validation**
- Evaluation period: **2024-01-02 to 2024-12-31** (252 trading days)
- Asset: **SPY**
- Data: `yfinance` daily `Close`, 2015-01-02 to 2025-12-31 (2766 rows)
- Protocol: 1024-day past-only context, horizon 1, median forecast, zero-shot, CPU.
- Data download timestamp: `2026-10-20T13:43:24+00:00`
- Raw data SHA-256: `f28c261ddb0cc27664ea63522ae3e9bb59f51f21b430d4fe23a3dae47f9ee8e5`
- Clean data SHA-256: `d7e1c5658d78cf8b5e68a7044457e5c725f7ea899b42dbf3fe18654e79f85036`
- Pooled results equal SPY because this benchmark contains one asset; the metrics schema carries `asset` for future additions.

## Results

| Model | n | MAE | RMSE | nMAE | nRMSE | Directional acc. | MAE 95% CI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Naive previous-close baseline (`naive`) | 252 | 3.1870 | 4.3164 | 0.0059 | 0.0080 | 0.0000 | [2.7784, 3.6127] |
| Google TimesFM 2.5 (`timesfm`) | 252 | 3.2233 | 4.4183 | 0.0060 | 0.0082 | 0.5556 | [2.7645, 3.6811] |
| Amazon Chronos-2 (`chronos2`) | 252 | 3.9049 | 4.9771 | 0.0072 | 0.0092 | 0.4325 | [3.4456, 4.3940] |

Directional accuracy compares `sign(pred - previous_close)` with `sign(actual - previous_close)`. The naive baseline forecasts no change, so its directional accuracy is 0 by construction unless the close is unchanged.
MAE intervals are 95% moving-block bootstrap (2000 repetitions, block length 6, seed 42).

## Runtime and memory

| Model | Load (s) | Setup/compile (s) | Inference total (s) | Mean latency (ms) | Median (ms) | p95 (ms) | Peak RSS | Delta RSS | ru_maxrss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive previous-close baseline | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 69.5 MiB | 0.0 MiB | 70.2 MiB |
| Google TimesFM 2.5 | 0.448 | 0.000 | 24.490 | 97.184 | 96.905 | 101.869 | 1,146.3 MiB | 921.9 MiB | 2,005.1 MiB |
| Amazon Chronos-2 | 0.429 | 0.000 | 9.209 | 36.543 | 36.400 | 38.161 | 818.1 MiB | 593.0 MiB | 818.5 MiB |

## Selection

Validation is a **sanity check only**. No model is selected from this split; the winner must be chosen from the one-shot 2025 test run.
Lowest validation MAE: **Naive previous-close baseline** (3.1870).

## Model details

- **Amazon Chronos-2**: checkpoint `amazon/chronos-2`, revision `29ec3766d36d6f73f0696f85560a422f50e8498c`, parameters 119,477,664, checkpoint size 455.8 MiB, library `chronos-forecasting==2.3.2`, load 0.429 s, setup 0.000 s.
- **Google TimesFM 2.5**: checkpoint `google/timesfm-2.5-200m-pytorch`, revision `1d952420fba87f3c6dee4f240de0f1a0fbc790e3`, parameters 231,289,280, checkpoint size 882.3 MiB, library `timesfm==3.0.2`, load 0.448 s, setup 0.000 s.
- **Naive previous-close baseline**: checkpoint `none`, revision `none`, parameters 0, checkpoint size n/a, library n/a (parameter-free), load 0.000 s, setup 0.000 s.

## Limitations

- One asset (SPY), one-day horizon, one chronological split. Results do not generalize to other assets or horizons.
- Unadjusted close contains dividend and split discontinuities; this matches the displayed price series but not a total-return series.
- Historical test metrics do not guarantee the accuracy of any individual future forecast. Forecasts are uncertain and are not financial advice.
- Validation numbers must not be reported as final test performance.

## Artifacts

- `run_config.json`, `environment.json`, `data_manifest.json`
- `models/chronos2.json`, `models/timesfm.json`, `models/naive.json`
- `predictions/<model>__SPY.csv`
- `metrics.csv`, `summary.md`, `plots/actual_vs_predicted.png`, `run.log`

# SPY foundation-model benchmark

- Run id: `test_20261020T134507Z`
- Split: **test**
- Evaluation period: **2025-01-02 to 2025-12-31** (250 trading days)
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
| Naive previous-close baseline (`naive`) | 250 | 4.4590 | 6.8681 | 0.0072 | 0.0111 | 0.0000 | [3.6637, 5.5245] |
| Google TimesFM 2.5 (`timesfm`) | 250 | 4.5301 | 7.1305 | 0.0073 | 0.0115 | 0.5760 | [3.6642, 5.6729] |
| Amazon Chronos-2 (`chronos2`) | 250 | 4.8028 | 7.1883 | 0.0077 | 0.0116 | 0.5120 | [3.9827, 5.9549] |

Directional accuracy compares `sign(pred - previous_close)` with `sign(actual - previous_close)`. The naive baseline forecasts no change, so its directional accuracy is 0 by construction unless the close is unchanged.
MAE intervals are 95% moving-block bootstrap (2000 repetitions, block length 6, seed 42).

## Runtime and memory

| Model | Load (s) | Setup/compile (s) | Inference total (s) | Mean latency (ms) | Median (ms) | p95 (ms) | Peak RSS | Delta RSS | ru_maxrss |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive previous-close baseline | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 69.5 MiB | 0.0 MiB | 70.2 MiB |
| Google TimesFM 2.5 | 1.252 | 0.000 | 27.835 | 111.339 | 111.714 | 117.003 | 1,047.5 MiB | 822.5 MiB | 1,896.7 MiB |
| Amazon Chronos-2 | 0.520 | 0.000 | 10.569 | 42.277 | 42.031 | 44.575 | 802.0 MiB | 577.0 MiB | 802.0 MiB |

## Selection

Per the locked rule (lowest test MAE; RMSE, latency, memory as tie-breakers), the winner is **Naive previous-close baseline (`naive`)** with test MAE **4.4590** and RMSE **6.8681**.

Among the pretrained foundation models, **Google TimesFM 2.5** is best with test MAE **4.5301** (1.59% above the naive baseline).

Conflict to resolve with the instructor: the benchmark rule selects the naive control, but the app requires a real ML forecast. Shipping the benchmark winner would ship the baseline; shipping the best pretrained model means accepting the MAE difference above. Do not silently replace the documented winner.

## Model details

- **Amazon Chronos-2**: checkpoint `amazon/chronos-2`, revision `29ec3766d36d6f73f0696f85560a422f50e8498c`, parameters 119,477,664, checkpoint size 455.8 MiB, library `chronos-forecasting==2.3.2`, load 0.520 s, setup 0.000 s.
- **Google TimesFM 2.5**: checkpoint `google/timesfm-2.5-200m-pytorch`, revision `1d952420fba87f3c6dee4f240de0f1a0fbc790e3`, parameters 231,289,280, checkpoint size 882.3 MiB, library `timesfm==3.0.2`, load 1.252 s, setup 0.000 s.
- **Naive previous-close baseline**: checkpoint `none`, revision `none`, parameters 0, checkpoint size n/a, library n/a (parameter-free), load 0.000 s, setup 0.000 s.

## Limitations

- One asset (SPY), one-day horizon, one chronological split. Results do not generalize to other assets or horizons.
- Unadjusted close contains dividend and split discontinuities; this matches the displayed price series but not a total-return series.
- Historical test metrics do not guarantee the accuracy of any individual future forecast. Forecasts are uncertain and are not financial advice.

## Artifacts

- `run_config.json`, `environment.json`, `data_manifest.json`
- `models/chronos2.json`, `models/timesfm.json`, `models/naive.json`
- `predictions/<model>__SPY.csv`
- `metrics.csv`, `summary.md`, `plots/actual_vs_predicted.png`, `run.log`

from __future__ import annotations

import os

_THREADS = int(os.environ.get("BENCHMARK_TORCH_THREADS", "8"))
os.environ.setdefault("OMP_NUM_THREADS", str(_THREADS))
os.environ.setdefault("MKL_NUM_THREADS", str(_THREADS))
os.environ.setdefault("OPENBLAS_NUM_THREADS", str(_THREADS))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import argparse
import json
import time
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import load_config, write_json
from .data import load_clean_prices
from .runtime import RSSSampler, latency_stats, rss_bytes, ru_maxrss_bytes, timer
from .splits import assert_no_lookahead, build_origins


def _library_version(name: str) -> str | None:
    if name in ("", "none"):
        return None
    try:
        return version(name)
    except PackageNotFoundError:
        return None


def _write_predictions(path: Path, rows: list[dict[str, Any]]) -> None:
    frame = pd.DataFrame(rows)
    columns = [
        "model",
        "asset",
        "split",
        "prediction_date",
        "target_date",
        "context_start_date",
        "context_end_date",
        "last_observed_date",
        "last_observed_close",
        "y_true",
        "y_pred",
        "error",
        "abs_error",
        "sq_error",
        "latency_ms",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    frame[columns].to_csv(path, index=False)


def run(args: argparse.Namespace) -> dict[str, Any]:
    config = load_config(args.config)
    model_cfg = config["models"][args.model]
    protocol = config["protocol"]
    context_length = int(protocol["context_length"])
    split_name = args.split
    split_cfg = config["splits"][split_name]

    close = load_clean_prices(args.data)
    origins = build_origins(close, split_cfg, context_length)
    assert_no_lookahead(origins, close, context_length)
    if len(origins) != int(split_cfg["expected_rows"]):
        raise AssertionError(f"{split_name} origins {len(origins)} != {split_cfg['expected_rows']}")

    harness_rss = rss_bytes()

    from .models import FORECASTERS

    forecaster_cls = FORECASTERS[args.model]
    forecaster = forecaster_cls(model_cfg["hyperparameters"])

    torch_threads = None
    if args.model != "naive":
        import torch

        torch.set_num_threads(_THREADS)
        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            pass
        torch_threads = torch.get_num_threads()

    after_imports_rss = rss_bytes()
    baseline_rss = rss_bytes()

    load_time_s = forecaster.load()
    after_load_rss = rss_bytes()
    setup_compile_time_s = forecaster.setup()
    after_setup_rss = rss_bytes()

    checkpoint = forecaster.checkpoint_info()
    parameter_count = forecaster.parameter_count()
    runtime_metadata = forecaster.runtime_metadata()

    warmup_count = int(protocol["warmup_forecasts"])
    warmup_count = min(warmup_count, len(origins))
    for origin in origins[:warmup_count]:
        forecaster.predict(origin.context)

    rows: list[dict[str, Any]] = []
    latencies_ms: list[float] = []
    with RSSSampler(interval_s=0.005) as sampler:
        for origin in origins:
            start = timer()
            prediction = forecaster.predict(origin.context)
            latency_ms = (timer() - start) * 1000.0
            latencies_ms.append(latency_ms)
            if not np.isfinite(prediction):
                raise RuntimeError(
                    f"model {args.model} produced non-finite forecast for "
                    f"{origin.prediction_date.date()}"
                )
            rows.append(
                {
                    "model": args.model,
                    "asset": config["asset"],
                    "split": split_name,
                    "prediction_date": origin.prediction_date.date().isoformat(),
                    "target_date": origin.target_date.date().isoformat(),
                    "context_start_date": origin.context_start_date.date().isoformat(),
                    "context_end_date": origin.context_end_date.date().isoformat(),
                    "last_observed_date": origin.context_end_date.date().isoformat(),
                    "last_observed_close": origin.last_observed_close,
                    "y_true": origin.y_true,
                    "y_pred": prediction,
                    "error": prediction - origin.y_true,
                    "abs_error": abs(prediction - origin.y_true),
                    "sq_error": (prediction - origin.y_true) ** 2,
                    "latency_ms": latency_ms,
                }
            )
        peak_inference_rss = sampler.peak_bytes

    latency = latency_stats(latencies_ms)
    predictions_path = Path(args.predictions_csv)
    _write_predictions(predictions_path, rows)

    train_range = config["splits"]["train"]
    validation_range = config["splits"]["validation"]
    test_range = config["splits"]["test"]
    hyperparameters = model_cfg["hyperparameters"]
    result = {
        "model": model_cfg["display_name"],
        "model_key": args.model,
        "checkpoint": model_cfg["checkpoint"],
        "revision": model_cfg["revision"],
        "checkpoint_file": checkpoint["checkpoint_file"],
        "checkpoint_sha256": checkpoint["checkpoint_sha256"],
        "checkpoint_size_bytes": checkpoint["checkpoint_size_bytes"],
        "parameter_count": parameter_count,
        "parameter_count_nominal": model_cfg["parameters"],
        "library": model_cfg["library"],
        "library_version": model_cfg["library_version"],
        "library_version_resolved": _library_version(model_cfg["library"]),
        "asset": config["asset"],
        "split": split_name,
        "input_window": context_length,
        "horizon": int(protocol["horizon"]),
        "forecast_statistic": protocol["forecast_statistic"],
        "quantile": float(protocol["quantile"]),
        "target": config["protocol"]["target"],
        "train_range": {"start": train_range["start"], "end": train_range["end"]},
        "validation_range": {"start": validation_range["start"], "end": validation_range["end"]},
        "test_range": {"start": test_range["start"], "end": test_range["end"]},
        "hyperparameters": hyperparameters,
        "feature_definitions": config["feature_definitions"],
        "protocol": {
            "no_covariates": True,
            "no_cross_learning": True,
            "no_fine_tuning": True,
            "no_dataset_level_scaling": True,
            "context_is_past_only": True,
        },
        "training_regime": model_cfg["training_regime"],
        "training_time_s": 0.0,
        "load_time_s": load_time_s,
        "setup_compile_time_s": setup_compile_time_s,
        "inference": {
            "warmup_forecasts_excluded": warmup_count,
            "n_forecasts": len(rows),
            "split_rows": int(split_cfg["expected_rows"]),
            **latency,
        },
        "memory": {
            "measurement": "fresh subprocess, psutil RSS sampled every 5 ms during inference",
            "harness_rss_bytes": harness_rss,
            "after_model_imports_rss_bytes": after_imports_rss,
            "baseline_rss_bytes": baseline_rss,
            "after_load_rss_bytes": after_load_rss,
            "after_setup_rss_bytes": after_setup_rss,
            "peak_inference_rss_bytes": peak_inference_rss,
            "delta_from_baseline_bytes": peak_inference_rss - baseline_rss,
            "delta_from_after_setup_bytes": peak_inference_rss - after_setup_rss,
            "ru_maxrss_bytes": ru_maxrss_bytes(),
        },
        "torch_threads": torch_threads,
        "runtime_metadata": runtime_metadata,
        "predictions_file": str(predictions_path),
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    write_json(args.result_json, result)
    print(json.dumps({"model": args.model, "rows": len(rows), "status": "ok"}))
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Run one benchmark model in a fresh subprocess")
    parser.add_argument("--config", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--split", required=True, choices=["validation", "test"])
    parser.add_argument("--model", required=True, choices=["chronos2", "timesfm", "naive"])
    parser.add_argument("--result-json", required=True)
    parser.add_argument("--predictions-csv", required=True)
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()

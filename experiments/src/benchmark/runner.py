from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from .config import (
    EXPERIMENTS_ROOT,
    MODEL_ORDER,
    RESULTS_DIR,
    load_config,
    write_json,
)
from .data import ensure_data
from .environment import collect_environment
from .metrics import evaluate_predictions

METRICS_COLUMNS = [
    "model",
    "model_name",
    "checkpoint",
    "revision",
    "asset",
    "split",
    "n",
    "mae",
    "rmse",
    "nmae",
    "nrmse",
    "directional_accuracy",
    "mae_ci_low",
    "mae_ci_high",
    "rmse_ci_low",
    "rmse_ci_high",
    "mean_eval_close",
    "train_start",
    "train_end",
    "validation_start",
    "validation_end",
    "test_start",
    "test_end",
    "context_length",
    "horizon",
    "training_regime",
    "training_time_s",
    "load_time_s",
    "setup_compile_time_s",
    "total_inference_time_s",
    "latency_mean_ms",
    "latency_median_ms",
    "latency_p95_ms",
    "warmup_forecasts_excluded",
    "baseline_rss_bytes",
    "after_load_rss_bytes",
    "after_setup_rss_bytes",
    "peak_inference_rss_bytes",
    "delta_from_baseline_bytes",
    "ru_maxrss_bytes",
    "parameter_count",
    "checkpoint_size_bytes",
    "library",
    "library_version",
]


def _utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def prefetch_models(config: dict[str, Any], log_path: Path | None = None) -> dict[str, Any]:
    from huggingface_hub import snapshot_download

    result: dict[str, Any] = {}
    for key, model_cfg in config["models"].items():
        if key == "naive":
            continue
        start = time.perf_counter()
        path = snapshot_download(
            repo_id=model_cfg["checkpoint"],
            revision=model_cfg["revision"],
        )
        elapsed = time.perf_counter() - start
        result[key] = {
            "checkpoint": model_cfg["checkpoint"],
            "revision": model_cfg["revision"],
            "snapshot_path": path,
            "warm_cache_elapsed_s": elapsed,
        }
        if log_path:
            with log_path.open("a") as fh:
                fh.write(f"[prefetch] {key}: cache warm in {elapsed:.3f}s ({path})\n")
    return result


def _metrics_row(
    model_key: str,
    model_json: dict[str, Any],
    predictions: pd.DataFrame,
    config: dict[str, Any],
    split: str,
    metrics: dict[str, float],
) -> dict[str, Any]:
    model_cfg = config["models"][model_key]
    protocol = config["protocol"]
    train = config["splits"]["train"]
    validation = config["splits"]["validation"]
    test = config["splits"]["test"]
    memory = model_json["memory"]
    inference = model_json["inference"]
    return {
        "model": model_key,
        "model_name": model_cfg["display_name"],
        "checkpoint": model_json["checkpoint"],
        "revision": model_json["revision"],
        "asset": config["asset"],
        "split": split,
        "n": metrics["n"],
        "mae": metrics["mae"],
        "rmse": metrics["rmse"],
        "nmae": metrics["nmae"],
        "nrmse": metrics["nrmse"],
        "directional_accuracy": metrics["directional_accuracy"],
        "mae_ci_low": metrics.get("mae_ci_low"),
        "mae_ci_high": metrics.get("mae_ci_high"),
        "rmse_ci_low": metrics.get("rmse_ci_low"),
        "rmse_ci_high": metrics.get("rmse_ci_high"),
        "mean_eval_close": metrics["mean_eval_close"],
        "train_start": train["start"],
        "train_end": train["end"],
        "validation_start": validation["start"],
        "validation_end": validation["end"],
        "test_start": test["start"],
        "test_end": test["end"],
        "context_length": protocol["context_length"],
        "horizon": protocol["horizon"],
        "training_regime": model_cfg["training_regime"],
        "training_time_s": model_json["training_time_s"],
        "load_time_s": model_json["load_time_s"],
        "setup_compile_time_s": model_json["setup_compile_time_s"],
        "total_inference_time_s": inference["total_inference_time_s"],
        "latency_mean_ms": inference["latency_mean_ms"],
        "latency_median_ms": inference["latency_median_ms"],
        "latency_p95_ms": inference["latency_p95_ms"],
        "warmup_forecasts_excluded": inference["warmup_forecasts_excluded"],
        "baseline_rss_bytes": memory["baseline_rss_bytes"],
        "after_load_rss_bytes": memory["after_load_rss_bytes"],
        "after_setup_rss_bytes": memory["after_setup_rss_bytes"],
        "peak_inference_rss_bytes": memory["peak_inference_rss_bytes"],
        "delta_from_baseline_bytes": memory["delta_from_baseline_bytes"],
        "ru_maxrss_bytes": memory["ru_maxrss_bytes"],
        "parameter_count": model_json["parameter_count"],
        "checkpoint_size_bytes": model_json["checkpoint_size_bytes"],
        "library": model_json["library"],
        "library_version": model_json["library_version_resolved"],
    }


def _plot_predictions(prediction_frames: dict[str, pd.DataFrame], out_path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(12, 5.5))
    first = next(iter(prediction_frames.values()))
    dates = pd.to_datetime(first["target_date"])
    ax.plot(dates, first["y_true"], color="black", linewidth=1.6, label="Actual close")
    colors = {"chronos2": "#1f77b4", "timesfm": "#d62728", "naive": "#2ca02c"}
    for key, frame in prediction_frames.items():
        ax.plot(
            pd.to_datetime(frame["target_date"]),
            frame["y_pred"],
            linewidth=1.1,
            alpha=0.9,
            label=key,
            color=colors.get(key),
        )
    ax.set_title("SPY one-day-ahead close: actual vs predicted")
    ax.set_xlabel("Target date")
    ax.set_ylabel("Price (USD)")
    ax.grid(alpha=0.25)
    ax.legend()
    fig.tight_layout()
    fig.savefig(out_path, dpi=160)
    plt.close(fig)


def _fmt(value: Any, digits: int = 4) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:,.{digits}f}"
    return str(value)


def _fmt_bytes(value: Any) -> str:
    if value is None:
        return "n/a"
    return f"{value / 1024**2:,.1f} MiB"


def _write_summary(
    run_dir: Path,
    run_id: str,
    split: str,
    config: dict[str, Any],
    metrics: pd.DataFrame,
    model_jsons: dict[str, dict[str, Any]],
    data_manifest: dict[str, Any],
) -> None:
    lines: list[str] = []
    lines.append("# SPY foundation-model benchmark\n")
    lines.append(f"- Run id: `{run_id}`")
    lines.append(f"- Split: **{split}**")
    split_cfg = config["splits"][split]
    lines.append(
        f"- Evaluation period: **{split_cfg['start']} to {split_cfg['end']}** "
        f"({split_cfg['expected_rows']} trading days)"
    )
    lines.append(f"- Asset: **{config['asset']}**")
    lines.append(
        f"- Data: `{config['data']['provider']}` daily `{config['data']['price_column']}`, "
        f"{data_manifest['date_range']['start']} to {data_manifest['date_range']['end']} "
        f"({data_manifest['date_range']['trading_rows']} rows)"
    )
    lines.append(
        f"- Protocol: {config['protocol']['context_length']}-day past-only context, "
        f"horizon {config['protocol']['horizon']}, median forecast, zero-shot, CPU."
    )
    lines.append(f"- Data download timestamp: `{data_manifest['download_timestamp_utc']}`")
    lines.append(f"- Raw data SHA-256: `{data_manifest['raw_file']['sha256']}`")
    lines.append(f"- Clean data SHA-256: `{data_manifest['clean_file']['sha256']}`")
    lines.append(
        "- Pooled results equal SPY because this benchmark contains one asset; the "
        "metrics schema carries `asset` for future additions.\n"
    )

    lines.append("## Results\n")
    lines.append(
        "| Model | n | MAE | RMSE | nMAE | nRMSE | Directional acc. | MAE 95% CI |"
    )
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    for _, row in metrics.sort_values("mae").iterrows():
        ci = (
            f"[{_fmt(row['mae_ci_low'])}, {_fmt(row['mae_ci_high'])}]"
            if pd.notna(row["mae_ci_low"])
            else "n/a"
        )
        lines.append(
            f"| {row['model_name']} (`{row['model']}`) | {int(row['n'])} | "
            f"{_fmt(row['mae'])} | {_fmt(row['rmse'])} | {_fmt(row['nmae'])} | "
            f"{_fmt(row['nrmse'])} | {_fmt(row['directional_accuracy'], 4)} | {ci} |"
        )
    lines.append("")
    lines.append(
        "Directional accuracy compares `sign(pred - previous_close)` with "
        "`sign(actual - previous_close)`. The naive baseline forecasts no change, so its "
        "directional accuracy is 0 by construction unless the close is unchanged."
    )
    boot = config["metrics"]["bootstrap"]
    lines.append(
        f"MAE intervals are {int(boot['confidence'] * 100)}% moving-block bootstrap "
        f"({int(boot['repetitions'])} repetitions, block length {int(boot['block_length'])}, "
        f"seed {int(boot['seed'])})."
    )
    lines.append("")

    lines.append("## Runtime and memory\n")
    lines.append(
        "| Model | Load (s) | Setup/compile (s) | Inference total (s) | "
        "Mean latency (ms) | Median (ms) | p95 (ms) | Peak RSS | Delta RSS | ru_maxrss |"
    )
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for _, row in metrics.sort_values("mae").iterrows():
        lines.append(
            f"| {row['model_name']} | {_fmt(row['load_time_s'], 3)} | "
            f"{_fmt(row['setup_compile_time_s'], 3)} | {_fmt(row['total_inference_time_s'], 3)} | "
            f"{_fmt(row['latency_mean_ms'], 3)} | {_fmt(row['latency_median_ms'], 3)} | "
            f"{_fmt(row['latency_p95_ms'], 3)} | {_fmt_bytes(row['peak_inference_rss_bytes'])} | "
            f"{_fmt_bytes(row['delta_from_baseline_bytes'])} | "
            f"{_fmt_bytes(row['ru_maxrss_bytes'])} |"
        )
    lines.append("")

    lines.append("## Selection\n")
    best = metrics.sort_values(["mae", "rmse"]).iloc[0]
    if split == "test":
        lines.append(
            f"Per the locked rule (lowest test MAE; RMSE, latency, memory as tie-breakers), "
            f"the winner is **{best['model_name']} (`{best['model']}`)** with test MAE "
            f"**{_fmt(best['mae'])}** and RMSE **{_fmt(best['rmse'])}**."
        )
        foundation = metrics[metrics["model"] != "naive"].sort_values(
            ["mae", "rmse"]
        )
        if best["model"] == "naive" and not foundation.empty:
            runner_up = foundation.iloc[0]
            lines.append("")
            lines.append(
                f"Among the pretrained foundation models, **{runner_up['model_name']}** "
                f"is best with test MAE **{_fmt(runner_up['mae'])}** "
                f"({_fmt((runner_up['mae'] / best['mae'] - 1.0) * 100.0, 2)}% above the "
                "naive baseline)."
            )
            lines.append("")
            lines.append(
                "Conflict to resolve with the instructor: the benchmark rule selects the "
                "naive control, but the app requires a real ML forecast. Shipping the "
                "benchmark winner would ship the baseline; shipping the best pretrained "
                "model means accepting the MAE difference above. Do not silently replace "
                "the documented winner."
            )
    else:
        lines.append(
            "Validation is a **sanity check only**. No model is selected from this split; "
            "the winner must be chosen from the one-shot 2025 test run."
        )
        lines.append(
            f"Lowest validation MAE: **{best['model_name']}** ({_fmt(best['mae'])})."
        )
    lines.append("")

    lines.append("## Model details\n")
    for key in MODEL_ORDER:
        if key not in model_jsons:
            continue
        info = model_jsons[key]
        library = (
            f"`{info['library']}=={info['library_version_resolved']}`"
            if info["library"] not in (None, "none")
            else "n/a (parameter-free)"
        )
        lines.append(
            f"- **{info['model']}**: checkpoint `{info['checkpoint']}`, revision "
            f"`{info['revision']}`, parameters {info['parameter_count']:,}, "
            f"checkpoint size {_fmt_bytes(info['checkpoint_size_bytes'])}, library "
            f"{library}, load {_fmt(info['load_time_s'], 3)} s, setup "
            f"{_fmt(info['setup_compile_time_s'], 3)} s."
        )
    lines.append("")

    lines.append("## Limitations\n")
    lines.append(
        "- One asset (SPY), one-day horizon, one chronological split. Results do not "
        "generalize to other assets or horizons."
    )
    lines.append(
        "- Unadjusted close contains dividend and split discontinuities; this matches the "
        "displayed price series but not a total-return series."
    )
    lines.append(
        "- Historical test metrics do not guarantee the accuracy of any individual future "
        "forecast. Forecasts are uncertain and are not financial advice."
    )
    if split == "validation":
        lines.append("- Validation numbers must not be reported as final test performance.")
    lines.append("")

    lines.append("## Artifacts\n")
    lines.append("- `run_config.json`, `environment.json`, `data_manifest.json`")
    lines.append("- `models/chronos2.json`, `models/timesfm.json`, `models/naive.json`")
    lines.append("- `predictions/<model>__SPY.csv`")
    lines.append("- `metrics.csv`, `summary.md`, `plots/actual_vs_predicted.png`, `run.log`")
    lines.append("")

    (run_dir / "summary.md").write_text("\n".join(lines))


def run_split(
    config: dict[str, Any],
    split: str,
    prefetch: dict[str, Any],
    environment: dict[str, Any],
    data_path: Path,
    data_manifest: dict[str, Any],
    config_path: Path,
) -> Path:
    stamp = _utc_stamp()
    run_id = f"{split}_{stamp}"
    benchmark_id = config["benchmark_id"]
    run_dir = RESULTS_DIR / benchmark_id / run_id
    for sub in ("models", "predictions", "plots"):
        (run_dir / sub).mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "run.log"
    log_path.write_text("")

    run_config = {
        "run_id": run_id,
        "benchmark_id": benchmark_id,
        "split": split,
        "created_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "selection_allowed": split == "test",
        "config_path": str(config_path),
        "config": config,
        "data_clean_path": str(data_path),
        "data_manifest": data_manifest,
        "model_prefetch": prefetch,
        "models_order": list(MODEL_ORDER),
        "command": " ".join(sys.argv),
    }
    write_json(run_dir / "run_config.json", run_config)
    write_json(run_dir / "environment.json", {**environment, "model_prefetch": prefetch})
    write_json(run_dir / "data_manifest.json", data_manifest)

    env = os.environ.copy()
    env["PYTHONPATH"] = str(EXPERIMENTS_ROOT / "src")
    env["BENCHMARK_TORCH_THREADS"] = str(config["protocol"]["torch_threads"])
    env["OMP_NUM_THREADS"] = str(config["protocol"]["torch_threads"])
    env["MKL_NUM_THREADS"] = str(config["protocol"]["torch_threads"])

    prediction_frames: dict[str, pd.DataFrame] = {}
    model_jsons: dict[str, dict[str, Any]] = {}
    for model_key in MODEL_ORDER:
        result_json = run_dir / "models" / f"{model_key}.json"
        predictions_csv = run_dir / "predictions" / f"{model_key}__SPY.csv"
        command = [
            sys.executable,
            "-m",
            "benchmark.worker",
            "--config",
            str(config_path),
            "--data",
            str(data_path),
            "--split",
            split,
            "--model",
            model_key,
            "--result-json",
            str(result_json),
            "--predictions-csv",
            str(predictions_csv),
        ]
        with log_path.open("a") as log_fh:
            log_fh.write(f"\n[{datetime.now(UTC).isoformat()}] START {model_key}\n")
            log_fh.write(" ".join(command) + "\n")
            log_fh.flush()
            start = time.perf_counter()
            completed = subprocess.run(
                command,
                cwd=EXPERIMENTS_ROOT,
                env=env,
                stdout=log_fh,
                stderr=subprocess.STDOUT,
                text=True,
            )
            elapsed = time.perf_counter() - start
            log_fh.write(f"[{datetime.now(UTC).isoformat()}] END {model_key} "
                         f"exit={completed.returncode} wall={elapsed:.2f}s\n")
        if completed.returncode != 0:
            raise RuntimeError(
                f"model {model_key} failed on split {split}; see {log_path}"
            )
        model_jsons[model_key] = json.loads(result_json.read_text())
        prediction_frames[model_key] = pd.read_csv(predictions_csv)

    metric_rows = []
    for model_key in MODEL_ORDER:
        model_json = model_jsons[model_key]
        predictions = prediction_frames[model_key]
        metrics = evaluate_predictions(predictions, config["metrics"]["bootstrap"])
        predictions.attrs["metrics"] = metrics
        metric_rows.append(
            _metrics_row(model_key, model_json, predictions, config, split, metrics)
        )

    metrics_frame = pd.DataFrame(metric_rows)
    metrics_frame = metrics_frame[METRICS_COLUMNS]
    metrics_frame.to_csv(run_dir / "metrics.csv", index=False)

    _plot_predictions(prediction_frames, run_dir / "plots" / "actual_vs_predicted.png")
    _write_summary(
        run_dir,
        run_id,
        split,
        config,
        metrics_frame,
        model_jsons,
        data_manifest,
    )
    with log_path.open("a") as log_fh:
        log_fh.write(f"\n[{datetime.now(UTC).isoformat()}] COMPLETE {split}\n")
    return run_dir


def run_benchmark(
    config_path: str | Path,
    split: str = "both",
    force_data: bool = False,
) -> list[Path]:
    config_path = Path(config_path)
    config = load_config(config_path)
    data_path, data_manifest = ensure_data(config, force=force_data)
    environment = collect_environment(torch_threads=int(config["protocol"]["torch_threads"]))
    environment["benchmark_id"] = config["benchmark_id"]
    environment["harness"] = "experiments/src/benchmark"
    prefetch = prefetch_models(config)
    environment["model_prefetch"] = prefetch

    splits = ["validation", "test"] if split == "both" else [split]
    run_dirs: list[Path] = []
    for name in splits:
        run_dirs.append(
            run_split(
                config,
                name,
                prefetch,
                environment,
                data_path,
                data_manifest,
                config_path,
            )
        )
    return run_dirs

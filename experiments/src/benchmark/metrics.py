from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


def point_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    if y_true.shape != y_pred.shape or y_true.size == 0:
        raise ValueError("y_true and y_pred must be non-empty and the same shape")
    errors = y_pred - y_true
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors**2)))
    mean_close = float(np.mean(y_true))
    return {
        "n": int(y_true.size),
        "mae": mae,
        "rmse": rmse,
        "nmae": mae / mean_close,
        "nrmse": rmse / mean_close,
        "mean_eval_close": mean_close,
    }


def directional_accuracy(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    previous_close: np.ndarray,
) -> float:
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    previous_close = np.asarray(previous_close, dtype=np.float64)
    actual_direction = np.sign(y_true - previous_close)
    predicted_direction = np.sign(y_pred - previous_close)
    return float(np.mean(actual_direction == predicted_direction))


def moving_block_bootstrap(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    repetitions: int = 2000,
    block_length: int = 6,
    seed: int = 42,
    confidence: float = 0.95,
) -> dict[str, float]:
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)
    n = y_true.size
    if n == 0:
        raise ValueError("bootstrap requires at least one observation")
    block_length = max(1, min(block_length, n))
    blocks_per_sample = int(np.ceil(n / block_length))
    max_start = n - block_length
    rng = np.random.default_rng(seed)
    starts = rng.integers(0, max_start + 1, size=(repetitions, blocks_per_sample))
    offsets = np.arange(block_length)
    indices = (starts[:, :, None] + offsets).reshape(repetitions, -1)[:, :n]

    sampled_true = y_true[indices]
    sampled_pred = y_pred[indices]
    errors = sampled_pred - sampled_true
    mae = np.mean(np.abs(errors), axis=1)
    rmse = np.sqrt(np.mean(errors**2, axis=1))
    alpha = (1.0 - confidence) / 2.0
    return {
        "mae_ci_low": float(np.quantile(mae, alpha)),
        "mae_ci_high": float(np.quantile(mae, 1.0 - alpha)),
        "rmse_ci_low": float(np.quantile(rmse, alpha)),
        "rmse_ci_high": float(np.quantile(rmse, 1.0 - alpha)),
    }


def evaluate_predictions(
    predictions: pd.DataFrame,
    bootstrap_cfg: dict[str, Any] | None = None,
) -> dict[str, float]:
    required = {"y_true", "y_pred", "last_observed_close"}
    missing = required - set(predictions.columns)
    if missing:
        raise ValueError(f"predictions missing columns: {sorted(missing)}")
    metrics = point_metrics(predictions["y_true"], predictions["y_pred"])
    metrics["directional_accuracy"] = directional_accuracy(
        predictions["y_true"],
        predictions["y_pred"],
        predictions["last_observed_close"],
    )
    if bootstrap_cfg:
        metrics.update(
            moving_block_bootstrap(
                predictions["y_true"].to_numpy(),
                predictions["y_pred"].to_numpy(),
                repetitions=int(bootstrap_cfg["repetitions"]),
                block_length=int(bootstrap_cfg["block_length"]),
                seed=int(bootstrap_cfg["seed"]),
                confidence=float(bootstrap_cfg["confidence"]),
            )
        )
    return metrics

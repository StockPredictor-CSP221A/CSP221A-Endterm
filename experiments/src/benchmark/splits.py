from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Origin:
    origin_index: int
    prediction_date: pd.Timestamp
    target_date: pd.Timestamp
    context_start_date: pd.Timestamp
    context_end_date: pd.Timestamp
    last_observed_close: float
    y_true: float
    context: np.ndarray


def split_indices(dates: pd.DatetimeIndex, split_cfg: dict[str, Any]) -> np.ndarray:
    start = pd.Timestamp(split_cfg["start"])
    end = pd.Timestamp(split_cfg["end"])
    mask = (dates >= start) & (dates <= end)
    return np.flatnonzero(mask)


def build_origins(
    close: pd.Series,
    split_cfg: dict[str, Any],
    context_length: int,
) -> list[Origin]:
    if context_length <= 0:
        raise ValueError("context_length must be positive")
    dates = pd.DatetimeIndex(close.index)
    values = close.to_numpy(dtype=np.float64)
    origins: list[Origin] = []
    for idx in split_indices(dates, split_cfg):
        idx = int(idx)
        if idx < context_length:
            raise ValueError(
                f"origin {dates[idx].date()} has only {idx} prior observations; "
                f"context_length={context_length}"
            )
        context = values[idx - context_length : idx]
        if len(context) != context_length:
            raise AssertionError("context length mismatch")
        origins.append(
            Origin(
                origin_index=idx,
                prediction_date=dates[idx],
                target_date=dates[idx],
                context_start_date=dates[idx - context_length],
                context_end_date=dates[idx - 1],
                last_observed_close=float(values[idx - 1]),
                y_true=float(values[idx]),
                context=context,
            )
        )
    return origins


def assert_no_lookahead(origins: list[Origin], close: pd.Series, context_length: int) -> None:
    values = close.to_numpy(dtype=np.float64)
    for origin in origins:
        idx = origin.origin_index
        if origin.context_end_date >= origin.target_date:
            raise AssertionError("context end must precede target date")
        expected = values[idx - context_length : idx]
        if not np.array_equal(origin.context, expected):
            raise AssertionError("context does not match past-only slice")
        if len(origin.context) != context_length or idx - context_length < 0:
            raise AssertionError("context window is invalid")
        if origin.context[-1] != origin.last_observed_close:
            raise AssertionError("last observed close mismatch")
        if origin.y_true != values[idx]:
            raise AssertionError("target mismatch")

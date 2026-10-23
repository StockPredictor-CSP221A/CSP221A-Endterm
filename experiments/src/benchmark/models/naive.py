from __future__ import annotations

from typing import Any

import numpy as np

from .base import Forecaster


class NaiveForecaster(Forecaster):
    key = "naive"
    display_name = "Naive previous-close baseline"
    checkpoint = "none"
    revision = "none"

    def __init__(self, hyperparameters: dict[str, Any] | None = None) -> None:
        self.hyperparameters = hyperparameters or {}

    def load(self) -> float:
        return 0.0

    def predict(self, context: np.ndarray) -> float:
        if len(context) == 0:
            raise ValueError("naive baseline requires at least one past close")
        return float(context[-1])

    def parameter_count(self) -> int:
        return 0

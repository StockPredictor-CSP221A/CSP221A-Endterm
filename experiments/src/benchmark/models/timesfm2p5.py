from __future__ import annotations

import time
from typing import Any

import numpy as np

from .base import Forecaster


class TimesFM25Forecaster(Forecaster):
    key = "timesfm"
    display_name = "Google TimesFM 2.5"
    checkpoint = "google/timesfm-2.5-200m-pytorch"
    revision = "1d952420fba87f3c6dee4f240de0f1a0fbc790e3"

    def __init__(self, hyperparameters: dict[str, Any] | None = None) -> None:
        self.hyperparameters = hyperparameters or {}

    def load(self) -> float:
        from timesfm import TimesFM_2p5_200M_torch

        start = time.perf_counter()
        self.model = TimesFM_2p5_200M_torch.from_pretrained(
            self.checkpoint,
            revision=self.revision,
            torch_compile=False,
        )
        return time.perf_counter() - start

    def setup(self) -> float:
        from timesfm import ForecastConfig

        hp = self.hyperparameters
        start = time.perf_counter()
        self.model.compile(
            ForecastConfig(
                max_context=int(hp["max_context"]),
                max_horizon=int(hp["horizon"]),
                normalize_inputs=bool(hp["normalize_inputs"]),
                use_continuous_quantile_head=bool(hp["use_continuous_quantile_head"]),
                force_flip_invariance=bool(hp["force_flip_invariance"]),
                infer_is_positive=bool(hp["infer_is_positive"]),
                fix_quantile_crossing=bool(hp["fix_quantile_crossing"]),
                per_core_batch_size=int(hp["per_core_batch_size"]),
            )
        )
        return time.perf_counter() - start

    def predict(self, context: np.ndarray) -> float:
        point_forecast, _ = self.model.forecast(1, [context])
        return float(np.asarray(point_forecast).reshape(-1)[0])

    def parameter_count(self) -> int:
        return int(sum(p.numel() for p in self.model.model.parameters()))

    def runtime_metadata(self) -> dict[str, Any]:
        return {
            "device": str(getattr(self.model.model, "device", "unknown")),
            "global_batch_size": getattr(self.model, "global_batch_size", None),
        }

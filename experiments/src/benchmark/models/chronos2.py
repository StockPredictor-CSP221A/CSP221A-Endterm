from __future__ import annotations

import time
from typing import Any

import numpy as np

from .base import Forecaster


class Chronos2Forecaster(Forecaster):
    key = "chronos2"
    display_name = "Amazon Chronos-2"
    checkpoint = "amazon/chronos-2"
    revision = "29ec3766d36d6f73f0696f85560a422f50e8498c"
    context_length = 1024

    def __init__(self, hyperparameters: dict[str, Any] | None = None) -> None:
        self.hyperparameters = hyperparameters or {}

    def load(self) -> float:
        import torch
        from chronos import BaseChronosPipeline

        start = time.perf_counter()
        self.pipeline = BaseChronosPipeline.from_pretrained(
            self.checkpoint,
            revision=self.revision,
            device_map="cpu",
            dtype=torch.float32,
        )
        elapsed = time.perf_counter() - start
        self.torch = torch
        return elapsed

    def predict(self, context: np.ndarray) -> float:
        tensor = self.torch.tensor(context, dtype=self.torch.float32).reshape(1, 1, -1)
        quantiles, _ = self.pipeline.predict_quantiles(
            tensor,
            prediction_length=1,
            quantile_levels=[0.5],
            context_length=self.context_length,
            batch_size=1,
            cross_learning=False,
        )
        return float(quantiles[0].detach().cpu().numpy().reshape(-1)[0])

    def parameter_count(self) -> int:
        return int(sum(p.numel() for p in self.pipeline.model.parameters()))

    def runtime_metadata(self) -> dict[str, Any]:
        return {
            "default_context_length": getattr(self.pipeline, "default_context_length", None),
            "model_context_length": getattr(self.pipeline, "model_context_length", None),
            "chronos_quantiles": getattr(self.pipeline, "quantiles", None),
        }

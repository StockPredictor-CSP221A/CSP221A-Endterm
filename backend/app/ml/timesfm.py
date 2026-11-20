from __future__ import annotations

import os
import threading

import numpy as np

from app.ml.forecast import CONTEXT_LENGTH

_CHECKPOINT = "google/timesfm-2.5-200m-pytorch"
_REVISION = "1d952420fba87f3c6dee4f240de0f1a0fbc790e3"


class TimesFMForecaster:
    def __init__(self) -> None:
        self.model = None

    def load(self) -> None:
        import torch
        from timesfm import ForecastConfig, TimesFM_2p5_200M_torch

        torch.set_num_threads(max(1, min(8, os.cpu_count() or 1)))
        self.model = TimesFM_2p5_200M_torch.from_pretrained(
            _CHECKPOINT,
            revision=_REVISION,
            torch_compile=False,
        )
        self.model.compile(
            ForecastConfig(
                max_context=CONTEXT_LENGTH,
                max_horizon=1,
                normalize_inputs=True,
                use_continuous_quantile_head=True,
                force_flip_invariance=True,
                infer_is_positive=True,
                fix_quantile_crossing=True,
                per_core_batch_size=1,
            )
        )

    def predict(self, context: list[float]) -> float:
        if self.model is None:
            self.load()

        point_forecast, _ = self.model.forecast(
            1, [np.asarray(context, dtype=np.float32)]
        )
        return float(np.asarray(point_forecast).reshape(-1)[0])


_forecaster: TimesFMForecaster | None = None
_lock = threading.Lock()


def get_forecaster() -> TimesFMForecaster:
    global _forecaster
    if _forecaster is None:
        with _lock:
            if _forecaster is None:
                forecaster = TimesFMForecaster()
                forecaster.load()
                _forecaster = forecaster
    return _forecaster

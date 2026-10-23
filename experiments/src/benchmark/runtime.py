from __future__ import annotations

import resource
import sys
import threading
import time
from typing import Any

import psutil


def rss_bytes() -> int:
    return int(psutil.Process().memory_info().rss)


def ru_maxrss_bytes() -> int:
    value = int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    if sys.platform == "darwin":
        return value
    return value * 1024


class RSSSampler:
    def __init__(self, interval_s: float = 0.005) -> None:
        self.interval_s = interval_s
        self._process = psutil.Process()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self.peak_bytes = self._process.memory_info().rss

    def _run(self) -> None:
        while not self._stop.is_set():
            self.peak_bytes = max(self.peak_bytes, self._process.memory_info().rss)
            self._stop.wait(self.interval_s)

    def __enter__(self) -> RSSSampler:
        self._thread.start()
        return self

    def __exit__(self, *args: Any) -> None:
        self._stop.set()
        self._thread.join(timeout=1.0)
        self.peak_bytes = max(self.peak_bytes, self._process.memory_info().rss)


def latency_stats(latencies_ms: list[float]) -> dict[str, float]:
    import numpy as np

    values = np.asarray(latencies_ms, dtype=np.float64)
    return {
        "latency_mean_ms": float(np.mean(values)),
        "latency_median_ms": float(np.median(values)),
        "latency_p95_ms": float(np.percentile(values, 95)),
        "latency_min_ms": float(np.min(values)),
        "latency_max_ms": float(np.max(values)),
        "total_inference_time_s": float(values.sum() / 1000.0),
    }


def timer() -> float:
    return time.perf_counter()

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

EXPERIMENTS_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = EXPERIMENTS_ROOT.parent
DATA_DIR = REPO_ROOT / "data"
RESULTS_DIR = EXPERIMENTS_ROOT / "results"
DEFAULT_CONFIG_PATH = EXPERIMENTS_ROOT / "configs" / "benchmark_spy.json"
MODEL_ORDER = ("chronos2", "timesfm", "naive")


def load_config(path: str | Path = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    with Path(path).open() as fh:
        return json.load(fh)


def write_json(path: str | Path, payload: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as fh:
        json.dump(payload, fh, indent=2, sort_keys=False, default=str)
        fh.write("\n")

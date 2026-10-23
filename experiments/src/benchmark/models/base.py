from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import numpy as np


class Forecaster:
    key: str = ""
    display_name: str = ""
    checkpoint: str = ""
    revision: str = ""

    def load(self) -> float:
        raise NotImplementedError

    def setup(self) -> float:
        return 0.0

    def predict(self, context: np.ndarray) -> float:
        raise NotImplementedError

    def parameter_count(self) -> int | None:
        return None

    def checkpoint_info(self) -> dict[str, Any]:
        if not self.checkpoint or self.revision == "none":
            return {
                "checkpoint_file": None,
                "checkpoint_sha256": None,
                "checkpoint_size_bytes": None,
            }
        from huggingface_hub import hf_hub_download

        path = Path(
            hf_hub_download(
                repo_id=self.checkpoint,
                filename="model.safetensors",
                revision=self.revision,
            )
        )
        digest = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                digest.update(chunk)
        return {
            "checkpoint_file": "model.safetensors",
            "checkpoint_sha256": digest.hexdigest(),
            "checkpoint_size_bytes": path.stat().st_size,
        }

    def runtime_metadata(self) -> dict[str, Any]:
        return {}

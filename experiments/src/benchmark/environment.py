from __future__ import annotations

import os
import platform
import subprocess
import sys
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

import psutil

from .config import REPO_ROOT

PACKAGES = (
    "torch",
    "transformers",
    "chronos-forecasting",
    "timesfm",
    "accelerate",
    "safetensors",
    "huggingface-hub",
    "numpy",
    "pandas",
    "yfinance",
    "psutil",
    "matplotlib",
)


def _package_versions() -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    for name in PACKAGES:
        try:
            out[name] = version(name)
        except PackageNotFoundError:
            out[name] = None
    return out


def _git(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(REPO_ROOT), *args],
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""
    return result.stdout.strip()


def _cpu_brand() -> str:
    if sys.platform == "darwin":
        try:
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                check=True,
                capture_output=True,
                text=True,
            )
            return result.stdout.strip()
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
    return platform.processor() or "unknown"


def git_info() -> dict[str, Any]:
    commit = _git("rev-parse", "HEAD")
    status = _git("status", "--porcelain")
    return {
        "commit": commit or None,
        "commit_short": commit[:12] if commit else None,
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD") or None,
        "dirty": bool(status),
        "status_porcelain": status.splitlines(),
    }


def collect_environment(torch_threads: int = 8) -> dict[str, Any]:
    import torch

    torch.set_num_threads(torch_threads)
    try:
        torch.set_num_interop_threads(1)
    except RuntimeError:
        pass
    memory = psutil.virtual_memory()
    return {
        "created_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "hardware": {
            "cpu_brand": _cpu_brand(),
            "machine": platform.machine(),
            "node": platform.node(),
            "physical_cores": psutil.cpu_count(logical=False),
            "logical_cores": psutil.cpu_count(logical=True),
            "total_ram_bytes": int(memory.total),
            "total_ram_gib": round(memory.total / 1024**3, 2),
        },
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "mac_ver": platform.mac_ver()[0] if sys.platform == "darwin" else None,
            "platform": platform.platform(),
        },
        "python": {
            "version": sys.version,
            "version_info": list(sys.version_info[:3]),
            "executable": sys.executable,
            "implementation": platform.python_implementation(),
        },
        "packages": _package_versions(),
        "torch": {
            "version": torch.__version__,
            "configured_threads": torch_threads,
            "num_threads": torch.get_num_threads(),
            "num_interop_threads": torch.get_num_interop_threads(),
            "cuda_available": bool(torch.cuda.is_available()),
            "mps_available": bool(torch.backends.mps.is_available()),
            "device": "cpu",
            "dtype": "float32",
        },
        "thread_env": {
            key: os.environ.get(key)
            for key in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS")
        },
        "git": git_info(),
        "working_directory": str(Path.cwd()),
    }

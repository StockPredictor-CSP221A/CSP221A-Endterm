from __future__ import annotations

import argparse

from .config import DEFAULT_CONFIG_PATH
from .runner import run_benchmark


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the locked SPY 2015-2025 benchmark")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH))
    parser.add_argument(
        "--split",
        default="both",
        choices=["validation", "test", "both"],
        help="validation first, then the one-shot test pass",
    )
    parser.add_argument(
        "--force-data",
        action="store_true",
        help="redownload SPY data instead of reusing the cached raw file",
    )
    args = parser.parse_args()
    run_dirs = run_benchmark(args.config, split=args.split, force_data=args.force_data)
    for path in run_dirs:
        print(f"results: {path}")


if __name__ == "__main__":
    main()

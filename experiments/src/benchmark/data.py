from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from typing import Any

import pandas as pd

from .config import DATA_DIR, write_json

RAW_FILENAME = "SPY_yfinance_raw.csv"
CLEAN_FILENAME = "SPY_clean.csv"
MANIFEST_FILENAME = "SPY_data_manifest.json"


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _read_raw_close(raw_path: Path, symbol: str) -> pd.Series:
    raw = pd.read_csv(raw_path, header=[0, 1], index_col=0, parse_dates=True)
    if isinstance(raw.columns, pd.MultiIndex):
        if ("Close", symbol) in raw.columns:
            close = raw[("Close", symbol)]
        else:
            close = raw.xs("Close", axis=1, level=0).iloc[:, 0]
    else:
        close = raw["Close"]
    close.index = pd.to_datetime(close.index)
    close.name = "close"
    return pd.to_numeric(close, errors="coerce")


def _split_manifest(dates: pd.DatetimeIndex, config: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name, split in config["splits"].items():
        start, end = pd.Timestamp(split["start"]), pd.Timestamp(split["end"])
        mask = (dates >= start) & (dates <= end)
        actual = int(mask.sum())
        expected = int(split["expected_rows"])
        if actual != expected:
            raise ValueError(
                f"split {name!r} has {actual} rows, expected {expected} "
                f"({split['start']} to {split['end']})"
            )
        out[name] = {
            "start": split["start"],
            "end": split["end"],
            "rows": actual,
            "expected_rows": expected,
        }
    return out


def load_clean_prices(path: str | Path) -> pd.Series:
    frame = pd.read_csv(path, parse_dates=["date"])
    series = frame.set_index("date")["close"].sort_index()
    series.index.name = "date"
    series.name = "close"
    return series


def ensure_data(
    config: dict[str, Any],
    data_dir: str | Path = DATA_DIR,
    force: bool = False,
) -> tuple[Path, dict[str, Any]]:
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    raw_path = data_dir / RAW_FILENAME
    clean_path = data_dir / CLEAN_FILENAME
    manifest_path = data_dir / MANIFEST_FILENAME

    if not force and raw_path.exists() and clean_path.exists() and manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        expected = config["data"]["symbol"]
        if manifest.get("symbol") != expected:
            raise ValueError(
                f"cached data manifest is for {manifest.get('symbol')!r}, "
                f"not {expected!r}"
            )
        return clean_path, manifest

    import yfinance as yf

    download_timestamp = _utc_now()
    data_cfg = config["data"]
    raw = yf.download(
        data_cfg["symbol"],
        start=data_cfg["download_start"],
        end=data_cfg["download_end_exclusive"],
        interval=data_cfg["interval"],
        auto_adjust=bool(data_cfg["auto_adjust"]),
        actions=bool(data_cfg["actions"]),
        progress=False,
        threads=False,
    )
    if raw is None or raw.empty:
        raise RuntimeError("yfinance returned no data; refusing to fabricate prices")
    raw.to_csv(raw_path)

    close = _read_raw_close(raw_path, data_cfg["symbol"])
    rows_raw = int(len(close))
    missing = int(close.isna().sum())
    nonpositive = int((close.dropna() <= 0).sum())
    duplicates = int(close.index.duplicated().sum())

    clean = pd.DataFrame({"close": close})
    clean = clean.sort_index()
    clean = clean[~clean.index.duplicated(keep="last")]
    clean = clean.dropna(subset=["close"])
    clean = clean[clean["close"] > 0]

    start = pd.Timestamp(data_cfg["start"])
    end = pd.Timestamp(data_cfg["end"])
    clean = clean[(clean.index >= start) & (clean.index <= end)]
    clean.index.name = "date"
    clean_path.write_text(
        clean.reset_index().to_csv(index=False, date_format="%Y-%m-%d"),
    )

    split_info = _split_manifest(clean.index, config)
    manifest = {
        "symbol": data_cfg["symbol"],
        "asset_role": config.get("asset_role"),
        "provider": data_cfg["provider"],
        "download_timestamp_utc": download_timestamp,
        "provider_library": "yfinance",
        "provider_library_version": version("yfinance"),
        "request": {
            "symbol": data_cfg["symbol"],
            "start": data_cfg["download_start"],
            "end_exclusive": data_cfg["download_end_exclusive"],
            "interval": data_cfg["interval"],
            "auto_adjust": bool(data_cfg["auto_adjust"]),
            "actions": bool(data_cfg["actions"]),
            "price_column": data_cfg["price_column"],
        },
        "raw_file": {
            "path": str(raw_path),
            "sha256": sha256_file(raw_path),
            "size_bytes": raw_path.stat().st_size,
            "rows_in_close_series": rows_raw,
        },
        "clean_file": {
            "path": str(clean_path),
            "sha256": sha256_file(clean_path),
            "size_bytes": clean_path.stat().st_size,
            "rows": int(len(clean)),
        },
        "selected_price_column": data_cfg["price_column"],
        "date_range": {
            "start": clean.index.min().date().isoformat(),
            "end": clean.index.max().date().isoformat(),
            "trading_rows": int(len(clean)),
        },
        "cleaning": {
            "sorted_by_date": True,
            "duplicate_dates_removed": duplicates,
            "missing_close_rows_removed": missing,
            "nonpositive_close_rows_removed": nonpositive,
            "interpolation": "none",
        },
        "splits": split_info,
        "split_boundary_observed_dates": {
            name: {
                "start": clean.loc[
                    (clean.index >= pd.Timestamp(split["start"]))
                    & (clean.index <= pd.Timestamp(split["end"]))
                ].index.min().date().isoformat(),
                "end": clean.loc[
                    (clean.index >= pd.Timestamp(split["start"]))
                    & (clean.index <= pd.Timestamp(split["end"]))
                ].index.max().date().isoformat(),
            }
            for name, split in config["splits"].items()
        },
        "manifest_created_utc": _utc_now(),
    }
    write_json(manifest_path, manifest)
    return clean_path, manifest

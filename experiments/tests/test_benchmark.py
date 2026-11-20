from __future__ import annotations

import numpy as np
import pandas as pd

from benchmark.metrics import (
    directional_accuracy,
    evaluate_predictions,
    moving_block_bootstrap,
    point_metrics,
)
from benchmark.models.naive import NaiveForecaster
from benchmark.splits import assert_no_lookahead, build_origins


def make_series(n: int = 3000) -> pd.Series:
    dates = pd.bdate_range("2010-01-04", periods=n)
    values = np.linspace(100.0, 100.0 + n, n)
    return pd.Series(values, index=dates, name="close")


def test_context_is_strictly_past_only():
    close = make_series()
    split = {
        "start": close.index[2000].date().isoformat(),
        "end": close.index[-1].date().isoformat(),
    }
    origins = build_origins(close, split, context_length=1024)
    assert len(origins) == 1000
    for origin in origins:
        idx = origin.origin_index
        assert origin.context_end_date < origin.target_date
        assert np.array_equal(origin.context, close.to_numpy()[idx - 1024 : idx])
        assert origin.context[-1] == close.iloc[idx - 1]
        assert origin.y_true == close.iloc[idx]


def test_rolling_origin_moves_one_trading_day():
    close = make_series()
    split = {
        "start": close.index[1500].date().isoformat(),
        "end": close.index[1600].date().isoformat(),
    }
    origins = build_origins(close, split, context_length=1024)
    assert [o.origin_index for o in origins] == list(range(1500, 1601))
    assert [o.prediction_date for o in origins] == list(close.index[1500:1601])


def test_no_future_data_changes_past_contexts():
    close = make_series()
    split = {
        "start": close.index[1500].date().isoformat(),
        "end": close.index[1600].date().isoformat(),
    }
    origins_before = build_origins(close, split, context_length=1024)
    changed = close.copy()
    changed.iloc[1550:] += 10_000.0
    origins_after = build_origins(changed, split, context_length=1024)
    for before, after in zip(origins_before[:50], origins_after[:50], strict=True):
        assert np.array_equal(before.context, after.context)
        assert before.y_true == after.y_true


def test_no_lookahead_helper_accepts_valid_origins():
    close = make_series()
    split = {
        "start": close.index[1200].date().isoformat(),
        "end": close.index[1400].date().isoformat(),
    }
    origins = build_origins(close, split, context_length=1024)
    assert_no_lookahead(origins, close, 1024)


def test_naive_predicts_previous_close():
    model = NaiveForecaster()
    context = np.array([1.0, 2.0, 3.5])
    assert model.predict(context) == 3.5
    assert model.parameter_count() == 0


def test_point_metrics_known_values():
    y_true = np.array([100.0, 102.0, 99.0])
    y_pred = np.array([101.0, 100.0, 99.0])
    out = point_metrics(y_true, y_pred)
    assert out["n"] == 3
    assert np.isclose(out["mae"], 1.0)
    assert np.isclose(out["rmse"], np.sqrt(5.0 / 3.0))


def test_directional_accuracy_counts_change_direction():
    previous = np.array([100.0, 100.0, 100.0])
    actual = np.array([101.0, 99.0, 100.0])
    predicted = np.array([102.0, 98.0, 101.0])
    assert directional_accuracy(actual, predicted, previous) == 2.0 / 3.0


def test_bootstrap_confidence_interval_is_ordered():
    rng = np.random.default_rng(0)
    y_true = 100 + np.cumsum(rng.normal(size=250))
    y_pred = y_true + rng.normal(scale=0.5, size=250)
    out = moving_block_bootstrap(y_true, y_pred, repetitions=200, block_length=5, seed=1)
    assert out["mae_ci_low"] <= out["mae_ci_high"]
    assert out["rmse_ci_low"] <= out["rmse_ci_high"]


def test_evaluate_predictions_includes_directional_accuracy():
    frame = pd.DataFrame(
        {
            "y_true": [101.0, 99.0],
            "y_pred": [102.0, 98.0],
            "last_observed_close": [100.0, 100.0],
        }
    )
    out = evaluate_predictions(frame)
    assert out["n"] == 2
    assert out["directional_accuracy"] == 1.0

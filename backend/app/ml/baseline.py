"""Naive baseline forecasters used to evaluate real models against.

Baseline: the next trading day's close is predicted to equal the most recent
observed close. Model evaluation must beat (or at least be compared to) this.
"""


def previous_close_forecast(closes: list[float]) -> float:
    if not closes:
        raise ValueError("closes must contain at least one observation")
    return closes[-1]

from .base import Forecaster
from .chronos2 import Chronos2Forecaster
from .naive import NaiveForecaster
from .timesfm2p5 import TimesFM25Forecaster

FORECASTERS = {
    "chronos2": Chronos2Forecaster,
    "timesfm": TimesFM25Forecaster,
    "naive": NaiveForecaster,
}

__all__ = [
    "FORECASTERS",
    "Chronos2Forecaster",
    "Forecaster",
    "NaiveForecaster",
    "TimesFM25Forecaster",
]

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PORT=7860

WORKDIR /app

RUN pip install --no-cache-dir uv==0.11.31 \
    && useradd --create-home --uid 1000 appuser

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --extra ml --no-install-project

COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser alembic ./alembic
COPY --chown=appuser:appuser alembic.ini ./

ENV PATH="/app/.venv/bin:$PATH" \
    HF_HOME=/home/appuser/.cache/huggingface

USER appuser

EXPOSE 7860

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]

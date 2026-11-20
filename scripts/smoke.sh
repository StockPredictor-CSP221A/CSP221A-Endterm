#!/usr/bin/env bash
set -euo pipefail

: "${API_URL:?Set API_URL, e.g. https://mikledez--stock-predictor-api-fastapi-app.us-east.modal.run}"

for path in /api/health /api/health/db; do
  printf "%s -> " "$path"
  curl -fsS "${API_URL}${path}"
  printf "\n"
done

printf "%s -> " "/api/stocks/NVDA/history?period=1mo"
curl -fsS "${API_URL}/api/stocks/NVDA/history?period=1mo" >/dev/null
printf "ok\n"

printf "%s -> " "POST /api/stocks/SPY/predict"
curl -fsS --max-time 300 -X POST "${API_URL}/api/stocks/SPY/predict" >/dev/null
printf "ok\n"

#!/usr/bin/env bash
set -euo pipefail

if ! command -v modal >/dev/null 2>&1; then
  echo "Modal CLI not found. Install it with: uv tool install modal" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root/backend"

modal deploy modal_app.py

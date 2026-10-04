#!/usr/bin/env sh
# Staging/production entrypoint (Render/Railway start command):
#   sh scripts/start.sh
# Migrates first, then serves with Uvicorn workers — never --reload.
set -eu

: "${PORT:=8000}"
: "${WEB_CONCURRENCY:=2}"

alembic upgrade head

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --workers "${WEB_CONCURRENCY}" \
  --proxy-headers

#!/bin/zsh
set -e

SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"

source venv/bin/activate
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

unset USE_SQLITE
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Add it to backend/.env or export it before using Postgres."
  return 1 2>/dev/null || exit 1
fi

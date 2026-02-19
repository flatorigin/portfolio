#!/usr/bin/env bash
set -euo pipefail

cd /app/backend

echo "DATABASE_URL is: ${DATABASE_URL:-<missing>}"
echo "MEDIA_ROOT is: ${MEDIA_ROOT:-<missing>}"

# Ensure mounted volume subfolder exists
mkdir -p "${MEDIA_ROOT:-/media/uploads}"

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn backend.wsgi:application \
  --bind 0.0.0.0:${PORT:-8080} \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  --timeout 120
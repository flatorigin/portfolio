#!/usr/bin/env bash
set -euo pipefail

cd /app/backend

# Provide safe defaults so staging doesn't crash if vars aren't set yet
DATABASE_URL="${DATABASE_URL:-}"
MEDIA_ROOT="${MEDIA_ROOT:-/media}"

echo "DATABASE_URL is: ${DATABASE_URL:-<missing>}"
echo "MEDIA_ROOT is: ${MEDIA_ROOT}"

echo "List /media:"
ls -la /media || true
echo "List /media/project_images (first 20):"
ls -la /media/project_images 2>/dev/null | head -n 20 || true

# Ensure mounted volume subfolder exists
mkdir -p "${MEDIA_ROOT}/project_images"
mkdir -p "${MEDIA_ROOT}/avatars"
mkdir -p "${MEDIA_ROOT}/uploads"

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn backend.wsgi:application \
  --bind 0.0.0.0:${PORT:-8080} \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  --timeout 120
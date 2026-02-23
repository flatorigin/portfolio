#!/usr/bin/env bash
set -euo pipefail

cd /app/backend

echo "DATABASE_URL is: ${DATABASE_URL:-<missing>}"
echo "MEDIA_ROOT is: ${MEDIA_ROOT:-<missing>}"

echo "List /media:"
ls -la /media || true
echo "List /media/project_images (first 20):"
ls -la /media/project_images 2>/dev/null | head -n 20 || true

# Ensure mounted volume subfolder exists
mkdir -p "${MEDIA_ROOT}/project_images"
mkdir -p "${MEDIA_ROOT}/avatars"

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn backend.wsgi:application \
  --bind 0.0.0.0:${PORT:-8080} \
  --access-logfile - \
  --error-logfile - \
  --capture-output \
  --timeout 120

python manage.py cleanup_media --dry-run --subdir project_images
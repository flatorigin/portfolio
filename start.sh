#!/usr/bin/env bash
set -e

cd /app/backend

echo "DATABASE_URL is: ${DATABASE_URL}"

python manage.py migrate --noinput

exec gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT}
#!/usr/bin/env bash
set -e

cd /app/backend

python manage.py migrate --noinput

exec gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT}
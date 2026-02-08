# start.sh

#!/usr/bin/env bash
set -e

cd /app/backend

# Run migrations after DATABASE_URL exists (runtime)
python manage.py migrate --noinput

# Start the server
exec gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
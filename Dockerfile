FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pip install --no-cache-dir -r backend/requirements.txt

ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

RUN cd frontend && npm install && npm run build

# collectstatic is fine at build-time

RUN cd backend && python manage.py collectstatic --noinput

RUN chmod +x /app/start.sh

EXPOSE 8080

CMD ["sh", "-c", "cd backend && python manage.py migrate && gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8080} --access-logfile - --error-logfile -"]
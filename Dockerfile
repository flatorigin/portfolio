# ---------- Stage 1: Build React ----------
FROM node:18 AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build


# ---------- Stage 2: Build Django ----------
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend

# Copy React build output into backend static folder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

WORKDIR /app/backend

RUN python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["gunicorn", "backend.wsgi:application", "--bind", "0.0.0.0:8080"]
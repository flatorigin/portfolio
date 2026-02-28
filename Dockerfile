# file: Dockerfile
FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pip install --no-cache-dir -r backend/requirements.txt

# --- Vite build-time vars (MUST be set before npm run build) ---
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
# --------------------------------------------------------------

RUN cd frontend && npm install && npm run build

RUN chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
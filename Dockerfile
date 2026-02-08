FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pip install --no-cache-dir -r backend/requirements.txt
RUN cd frontend && npm install && npm run build

# collectstatic is fine at build-time
RUN cd backend && python manage.py collectstatic --noinput

RUN chmod +x /app/start.sh

EXPOSE 8080

CMD ["/bin/bash", "/app/start.sh"]
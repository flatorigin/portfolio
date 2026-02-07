FROM python:3.13-slim

WORKDIR /app

# install system deps
RUN apt-get update && apt-get install -y nodejs npm

# copy project
COPY . .

# install backend deps
RUN pip install --no-cache-dir -r backend/requirements.txt

# build frontend
RUN cd frontend && npm install && npm run build

# django collect static + migrate
RUN cd backend && python manage.py collectstatic --noinput && python manage.py migrate

EXPOSE 8080

CMD gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT
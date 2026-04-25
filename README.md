# Django + DRF + JWT + React (Vite) — Portfolio Starter

**What’s inside**
- Backend: Django, Django REST Framework, Djoser (JWT), CORS, Pillow
- Frontend: React (Vite), Axios, React Router
- Features: user accounts, profiles/bio, projects with image uploads, public profile, contact form

## Quick Start

### 1) Python backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

### 2) React frontend
```bash
cd ../frontend
npm install
npm run dev
```
Open http://localhost:5173

### Notes
- Dev media files are saved under `backend/media/`.
- Update `frontend/src/api.js` baseURL if you change ports.
- In production, consider Postgres, S3 (django-storages), gunicorn, and proper CORS/ALLOWED_HOSTS.

## Troubleshooting migrations

If you see a startup error like:

`NodeNotFoundError: ... dependencies reference nonexistent parent node ('portfolio', '0005_directmessage')`

your local migration graph is out of sync with the repository. This project now uses
`portfolio.0005_messagethread_privatemessage_and_more`, not `portfolio.0005_directmessage`.

From `backend/`, run:

```bash
# 1) Confirm the migration file that exists in this repo
python manage.py showmigrations portfolio

# 2) Find stale local migration files that should not exist
find . -path "*/migrations/*.py" | grep directmessage

# 3) Apply repo migrations
python manage.py migrate
```

If you still have an old `accounts` migration that depends on
`('portfolio', '0005_directmessage')`, remove that stale migration file from your local tree,
then rerun `python manage.py makemigrations && python manage.py migrate`.

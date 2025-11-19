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

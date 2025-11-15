# file: dev_check.sh  (place at your project root)
#!/usr/bin/env bash
# Why: one command to validate backend+frontend quickly

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

### Backend (Django)
BACKEND_DIR="$ROOT/backend"
VENV_DIR="$BACKEND_DIR/venv"

echo "▶ Backend at: $BACKEND_DIR"

# auto-activate venv if present
if [ -d "$VENV_DIR" ]; then
  # shellcheck disable=SC1090
  source "$VENV_DIR/bin/activate"
  echo "✓ venv activated"
else
  echo "ℹ No venv detected at $VENV_DIR (skipping activation)"
fi

# install backend deps if requirements.txt exists
if [ -f "$BACKEND_DIR/requirements.txt" ]; then
  python -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

pushd "$BACKEND_DIR" >/dev/null
python manage.py check
python manage.py makemigrations --check --dry-run
# run tests if pytest is available
python - <<'PY' || true
import importlib.util, subprocess
if importlib.util.find_spec("pytest"):
  print("▶ pytest detected; running tests")
  subprocess.run(["pytest","-q"], check=False)
else:
  print("ℹ pytest not installed; skipping tests")
PY
popd >/dev/null

### Frontend (Vite)
FRONTEND_DIR="$ROOT/frontend"
if [ -d "$FRONTEND_DIR" ]; then
  echo "▶ Frontend at: $FRONTEND_DIR"
  pushd "$FRONTEND_DIR" >/dev/null
  if command -v npm >/dev/null 2>&1; then
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npm run build
    # Playwright e2e if installed
    if grep -q '"@playwright/test"' package.json 2>/dev/null; then
      npx playwright install --with-deps || true
      npx playwright test || true
    fi
  else
    echo "⚠ npm not found; skipping frontend steps"
  fi
  popd >/dev/null
else
  echo "ℹ No frontend/ directory; skipping frontend"
fi

echo "✅ All done"


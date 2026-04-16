#!/bin/zsh
set -e

SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"

source venv/bin/activate
export USE_SQLITE=1
unset DATABASE_URL

python manage.py migrate
python manage.py runserver

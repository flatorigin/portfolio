#!/bin/zsh
set -e

SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"

source ./use_postgres_env.sh
python manage.py migrate "$@"

# backend/use_postgres_env.sh
#!/bin/zsh
source venv/bin/activate
unset USE_SQLITE
export DATABASE_URL='postgresql://postgres:KbcovpZZQoRnvYrDABzWhezzCeChhpNR@ballast.proxy.rlwy.net:23799/railway'
exec zsh
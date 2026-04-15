# backend/backend/settings.py

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url


def parse_csv_env(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


BASE_DIR = Path(__file__).resolve().parent.parent
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "fallback-secret")
DEBUG = os.environ.get("DJANGO_DEBUG", "False") == "True"
ALLOWED_HOSTS = parse_csv_env(
    "DJANGO_ALLOWED_HOSTS",
    "localhost,127.0.0.1,flatorigin.com,www.flatorigin.com,portfolio-production-1b31.up.railway.app",
)

if not DEBUG and not ALLOWED_HOSTS:
    raise RuntimeError("DJANGO_ALLOWED_HOSTS must be set when DJANGO_DEBUG is False.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "portfolio.apps.PortfolioConfig",
    "rest_framework",
    "djoser",
    "corsheaders",
    "accounts.apps.AccountsConfig",
    "anymail",
    "apps.bids",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"

USE_SQLITE = os.getenv("USE_SQLITE", "").lower() in ("1", "true", "yes", "on")
SQLITE_PATH = os.getenv("SQLITE_PATH", "db.sqlite3")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if USE_SQLITE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.path.abspath(SQLITE_PATH),
        }
    }
else:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL must be set unless USE_SQLITE is enabled."
        )
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=False,
        )
    }

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
FRONTEND_ORIGIN = urlparse(FRONTEND_URL)
FRONTEND_EMAIL_DOMAIN = FRONTEND_ORIGIN.netloc or FRONTEND_ORIGIN.path
FRONTEND_EMAIL_PROTOCOL = FRONTEND_ORIGIN.scheme or "http"

FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist"
TEMPLATES[0]["DIRS"] = [FRONTEND_DIR]

STATICFILES_DIRS = [
    os.path.join(BASE_DIR.parent, "frontend", "dist"),
]

# --- Email (Resend via Anymail; fallback to console if no key) ---
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))

ANYMAIL = {
    "RESEND_API_KEY": os.environ.get("ANYMAIL_RESEND_API_KEY", ""),
}

DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL",
    "FlatOrigin <no-reply@flatorigin.com>",
)

EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    (
        "anymail.backends.resend.EmailBackend"
        if ANYMAIL["RESEND_API_KEY"]
        else "django.core.mail.backends.console.EmailBackend"
    ),
)

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

MEDIA_URL = "/media/"
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", os.path.join(BASE_DIR, "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = parse_csv_env(
    "CORS_ALLOWED_ORIGINS",
    f"{FRONTEND_URL},https://flatorigin.com,https://www.flatorigin.com,https://portfolio-production-1b31.up.railway.app",
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = parse_csv_env(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://flatorigin.com,https://www.flatorigin.com,https://portfolio-production-1b31.up.railway.app",
)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "AUTH_HEADER_TYPES": ("Bearer", "JWT"),
}

DJOSER = {
    "SEND_ACTIVATION_EMAIL": True,
    "SEND_CONFIRMATION_EMAIL": False,
    "ACTIVATION_URL": "activate/{uid}/{token}",
    "EMAIL_FRONTEND_DOMAIN": FRONTEND_EMAIL_DOMAIN,
    "EMAIL_FRONTEND_PROTOCOL": FRONTEND_EMAIL_PROTOCOL,
    "EMAIL_FRONTEND_SITE_NAME": "FlatOrigin",
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

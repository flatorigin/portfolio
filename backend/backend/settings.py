# backend/backend/settings.py

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url


def parse_csv_env(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def parse_bool_env(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


BASE_DIR = Path(__file__).resolve().parent.parent
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

RUNNING_ON_RAILWAY = any(
    os.getenv(name)
    for name in ("RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID")
)

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "fallback-secret")
DEBUG = parse_bool_env("DJANGO_DEBUG", default=not RUNNING_ON_RAILWAY)
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
    "accounts.middleware.AdminAccessAuditMiddleware",
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
SQLITE_PATH = os.getenv("SQLITE_PATH", str(BASE_DIR / "db.sqlite3"))
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if DATABASE_URL and not USE_SQLITE:
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=False,
        )
    }
else:
    if RUNNING_ON_RAILWAY and not USE_SQLITE:
        raise RuntimeError(
            "DATABASE_URL must be set on Railway unless USE_SQLITE is explicitly enabled."
        )
    sqlite_name = SQLITE_PATH if os.path.isabs(SQLITE_PATH) else str(BASE_DIR / SQLITE_PATH)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": sqlite_name,
        }
    }

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
FRONTEND_ORIGIN = urlparse(FRONTEND_URL)
FRONTEND_EMAIL_DOMAIN = FRONTEND_ORIGIN.netloc or FRONTEND_ORIGIN.path
FRONTEND_EMAIL_PROTOCOL = FRONTEND_ORIGIN.scheme or "http"

FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist"
TEMPLATES[0]["DIRS"] = [BASE_DIR / "accounts" / "templates", FRONTEND_DIR]

STATICFILES_DIRS = [
    os.path.join(BASE_DIR.parent, "frontend", "dist"),
]

# --- Email (Resend via Anymail; fallback to console if no key) ---
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))
EMAIL_FILE_PATH = os.environ.get("EMAIL_FILE_PATH", str(BASE_DIR / "sent_emails"))

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
        else "django.core.mail.backends.filebased.EmailBackend"
    ),
)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL_PRIMARY = os.environ.get("OPENAI_MODEL_PRIMARY", "gpt-5.4-mini").strip()
OPENAI_MODEL_LIGHT = os.environ.get("OPENAI_MODEL_LIGHT", "gpt-5.4-nano").strip()
AI_ENABLED = parse_bool_env("AI_ENABLED", default=False)
AI_DAILY_LIMIT_PER_USER = int(os.environ.get("AI_DAILY_LIMIT_PER_USER", "10"))

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

MEDIA_URL = "/media/"
MEDIA_ROOT = os.environ.get("MEDIA_ROOT", os.path.join(BASE_DIR, "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = parse_bool_env("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = parse_bool_env("CSRF_COOKIE_SECURE", default=not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

if not DEBUG:
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False

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
    "SERIALIZERS": {
        "user_create": "accounts.serializers.RoleAwareUserCreateSerializer",
    },
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

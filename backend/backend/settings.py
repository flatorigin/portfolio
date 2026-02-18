# backend/backend/settings.py

import os
import dj_database_url
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "fallback-secret")
DEBUG = os.environ.get("DJANGO_DEBUG", "False") == "True"
ALLOWED_HOSTS = ["*"]  # tighten later

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "djoser",
    "portfolio",
    "corsheaders",
    "accounts.apps.AccountsConfig",
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

DATABASES = {
    "default": dj_database_url.config(
        default=os.environ.get("DATABASE_URL"),
    )
}

# Where your React app lives (used to build password reset links)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist"
TEMPLATES[0]["DIRS"] = [FRONTEND_DIR]

STATICFILES_DIRS = [
    os.path.join(BASE_DIR.parent, "frontend", "dist"),
]

# Email
# Default to console backend to avoid SMTP hangs in production unless you explicitly set SMTP.
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)

EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")

EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))

DEFAULT_FROM_EMAIL = os.environ.get(
    "DEFAULT_FROM_EMAIL",
    EMAIL_HOST_USER or "babak@flatorigin.com",
)

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
}

CORS_ALLOW_ALL_ORIGINS = True

CORS_ALLOWED_ORIGINS = [
    "https://portfolio-production-1b31.up.railway.app",
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "https://portfolio-production-1b31.up.railway.app",
]

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "AUTH_HEADER_TYPES": ("Bearer", "JWT"),
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}


# backend/accounts/password_serializers.py

from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import get_connection, send_mail
from django.utils.encoding import force_str, force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers

token_generator = PasswordResetTokenGenerator()


class PasswordResetRequestSerializer(serializers.Serializer):
    """
    Takes an email, and if a user with that email exists,
    sends a reset link to that email.

    - Does not leak whether the email exists
    - Handles duplicate emails safely
    """
    email = serializers.EmailField()

    def validate_email(self, value):
        return value

    def save(self, **kwargs):
        email = self.validated_data["email"].strip()

        users = User.objects.filter(email__iexact=email, is_active=True)

        if not users.exists():
            return

        base_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com")

        subject = "Reset your password"
        connection = get_connection(timeout=getattr(settings, "EMAIL_TIMEOUT", 10))

        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = token_generator.make_token(user)

            reset_link = f"{base_url}/reset-password?uid={uid}&token={token}"
            message = (
                "You requested a password reset.\n\n"
                f"Click the link below to set a new password:\n{reset_link}\n\n"
                "If you didn't request this, you can ignore this email."
            )

            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[user.email],
                fail_silently=False,
                connection=connection,
            )


class PasswordResetConfirmSerializer(serializers.Serializer):
    """
    Takes uid + token + new_password and sets the user's password
    if the token is valid.
    """
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        uid = attrs.get("uid")
        token = attrs.get("token")

        try:
            uid_int = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=uid_int)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError("Invalid reset link")

        if not token_generator.check_token(user, token):
            raise serializers.ValidationError("Invalid or expired reset token")

        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        new_password = self.validated_data["new_password"]
        user.set_password(new_password)
        user.save()
        return user


# backend/accounts/password_views.py

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .password_serializers import PasswordResetRequestSerializer, PasswordResetConfirmSerializer


class PasswordResetRequestView(APIView):
    """
    POST { "email": "user@example.com" }
    Always returns 200 to avoid account enumeration.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "If that email exists, a reset link was sent."}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    POST { "uid": "...", "token": "...", "new_password": "..." }
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password has been reset."}, status=status.HTTP_200_OK)


# backend/accounts/urls.py

from django.urls import path

from .password_views import PasswordResetRequestView, PasswordResetConfirmView

urlpatterns = [
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password_reset_request"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
]
# backend/accounts/urls.py

from django.urls import path

from .views import MeView, PublicProfileView
from .password_views import PasswordResetRequestView, PasswordResetConfirmView

app_name = "accounts"

urlpatterns = [
    path("users/me/", MeView.as_view(), name="users-me"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("profiles/<str:username>/", PublicProfileView.as_view(), name="public-profile"),
]
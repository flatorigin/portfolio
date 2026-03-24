# backend/accounts/urls.py
from django.urls import path

from .views import MeView, PublicProfileView, ProfileLikeView, LikedProfilesView
from .password_views import PasswordResetRequestView, PasswordResetConfirmView

app_name = "accounts"

urlpatterns = [
    path("users/me/", MeView.as_view(), name="users-me"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),

    # ✅ put fixed/static routes FIRST
    path("profiles/liked/", LikedProfilesView.as_view(), name="liked-profiles"),

    # ✅ keep like route before/after public profile (either is fine)
    path("profiles/<str:username>/like/", ProfileLikeView.as_view(), name="profile-like"),
    path("profiles/<str:username>/", PublicProfileView.as_view(), name="public-profile"),
]
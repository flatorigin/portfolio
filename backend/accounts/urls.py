# backend/accounts/urls.py
from django.urls import path

from .views import (
    AIAssistView,
    MeView,
    SecurityChangePasswordView,
    SecurityDeactivateView,
    SecurityDeleteAccountView,
    SecuritySendVerificationEmailView,
    PublicProfileView,
    ProfileLikeView,
    LikedProfilesView,
    ProfileSaveView,
    SavedProfilesView,
    ContractorSearchView,
    HomeownerReferenceGalleryView,
    HomeownerReferenceGalleryItemView,
    PublicHomeownerReferenceGalleryListView,
    ReportCreateView,
)
from .password_views import PasswordResetRequestView, PasswordResetConfirmView

app_name = "accounts"

urlpatterns = [
    path("users/me/", MeView.as_view(), name="users-me"),
    path("users/me/security/change-password/", SecurityChangePasswordView.as_view(), name="security-change-password"),
    path("users/me/security/send-verification/", SecuritySendVerificationEmailView.as_view(), name="security-send-verification"),
    path("users/me/security/deactivate/", SecurityDeactivateView.as_view(), name="security-deactivate"),
    path("users/me/security/delete/", SecurityDeleteAccountView.as_view(), name="security-delete"),
    path("ai/assist/", AIAssistView.as_view(), name="ai-assist"),
    path("users/me/reference-gallery/", HomeownerReferenceGalleryView.as_view(), name="reference-gallery"),
    path("users/me/reference-gallery/<int:pk>/", HomeownerReferenceGalleryItemView.as_view(), name="reference-gallery-item"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),

    # ✅ put fixed/static routes FIRST
    path("profiles/liked/", LikedProfilesView.as_view(), name="liked-profiles"),
    path("profiles/saved/", SavedProfilesView.as_view(), name="saved-profiles"),
    path("profiles/contractors/search/", ContractorSearchView.as_view(), name="contractor-search"),
    path("profiles/homeowner-references/", PublicHomeownerReferenceGalleryListView.as_view(), name="homeowner-reference-gallery-list"),

    # ✅ keep like route before/after public profile (either is fine)
    path("profiles/<str:username>/like/", ProfileLikeView.as_view(), name="profile-like"),
    path("profiles/<str:username>/save/", ProfileSaveView.as_view(), name="profile-save"),
    path("profiles/<str:username>/", PublicProfileView.as_view(), name="public-profile"),
    path("reports/", ReportCreateView.as_view(), name="report-create"),
]

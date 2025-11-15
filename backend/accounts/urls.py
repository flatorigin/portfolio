# accounts/urls.py
from django.urls import path
from .views import MeView

app_name = "accounts"

urlpatterns = [
    path("users/me/", MeView.as_view(), name="users-me"),
]

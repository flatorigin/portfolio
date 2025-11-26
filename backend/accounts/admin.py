# accounts/admin.py
from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import Profile

User = get_user_model()

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "avatar")
    search_fields = ("user__username", "user__email")

class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "is_staff", "is_active")
    list_filter = ("is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email")
    ordering = ("id",)
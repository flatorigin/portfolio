# backend/accounts/models.py
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

# Backward-compat for old migrations that import this symbol
def logo_upload_path(instance, filename):
    return f"avatars/user_{instance.user_id}/{filename}"

def avatar_upload_path(instance, filename):
    # alias kept so existing migrations referencing this still work
    return logo_upload_path(instance, filename) 

def banner_upload_path(instance, filename):
    return f"banners/user_{instance.user_id}/{filename}"

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    logo = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)
    avatar = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)
    banner = models.ImageField(upload_to=banner_upload_path, blank=True, null=True)

    # Identity / company
    display_name = models.CharField(max_length=255, blank=True, default="")
    company_name = models.CharField(max_length=255, blank=True, default="")

    # Service
    service_location = models.CharField(max_length=255, blank=True, default="")
    coverage_radius_miles = models.PositiveIntegerField(blank=True, null=True)

    # About
    bio = models.TextField(blank=True, default="")

    # Optional contact info (NEW)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=50, blank=True, default="")

    @property
    def location(self):
        """Public-facing alias for service_location."""
        return self.service_location

    @location.setter
    def location(self, value):
        self.service_location = value

    def __str__(self) -> str:
        return f"Profile<{self.user_id}>"

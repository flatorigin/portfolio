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

    # Identity / company
    display_name = models.CharField(max_length=255, blank=True, default="")

    # Service
    service_location = models.CharField(max_length=255, blank=True, default="")
    coverage_radius_miles = models.PositiveIntegerField(blank=True, null=True)

    # About
    bio = models.TextField(blank=True, default="")

    # Optional contact info (NEW)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=50, blank=True, default="")
    
    # Media
    logo = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)

    # Back-compat with old name if needed
    avatar = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)

    # Public profile hero/banner
    banner = models.ImageField(upload_to=banner_upload_path, blank=True, null=True)

    def __str__(self) -> str:
        return f"Profile<{self.user_id}>"

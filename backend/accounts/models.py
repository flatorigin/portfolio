# backend/accounts/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings


User = get_user_model()

# Backward-compat for old migrations that import this symbol
def logo_upload_path(instance, filename):
    return f"avatars/user_{instance.user_id}/{filename}"

def avatar_upload_path(instance, filename):
    # alias kept so existing migrations referencing this still work
    return logo_upload_path(instance, filename) 
    
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

    banner = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)


    def __str__(self) -> str:
        return f"Profile<{self.user_id}>"

class ProfileLike(models.Model):
    """
    A 'like' from one user -> another user's profile.
    Used for "Save/Like public profile" (NOT project favorites).
    """
    liker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile_likes_given",
    )
    liked_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile_likes_received",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["liker", "liked_user"],
                name="unique_profile_like",
            )
        ]

    def __str__(self):
        return f"{self.liker_id} -> {self.liked_user_id}"
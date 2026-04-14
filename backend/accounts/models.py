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
    class ProfileType(models.TextChoices):
        CONTRACTOR = "contractor", "Contractor"
        HOMEOWNER = "homeowner", "Homeowner"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")

    # Identity / company
    display_name = models.CharField(max_length=255, blank=True, default="")
    profile_type = models.CharField(
        max_length=20,
        choices=ProfileType.choices,
        blank=True,
        default="",
    )

    # Service
    service_location = models.CharField(max_length=255, blank=True, default="")
    coverage_radius_miles = models.PositiveIntegerField(blank=True, null=True)

    # About
    bio = models.TextField(blank=True, default="")

    # Optional contact info (NEW)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=50, blank=True, default="")

    show_contact_email = models.BooleanField(default=False)
    show_contact_phone = models.BooleanField(default=False)
    
    # Media
    logo = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)

    # Back-compat with old name if needed
    avatar = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)

    banner = models.ImageField(upload_to=logo_upload_path, blank=True, null=True)

    # Hero copy (public profile)
    hero_headline = models.CharField(max_length=120, blank=True, default="")
    hero_blurb = models.TextField(blank=True, default="")

    languages = models.JSONField(default=list, blank=True)

    allow_direct_messages = models.BooleanField(default=True)

    dm_opt_out_reason = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        choices=[
            ("too_many", "Too many messages"),
            ("spam", "Spam"),
            ("not_ready", "Not ready yet"),
            ("other", "Other"),
        ],
    )

    dm_opt_out_until = models.DateTimeField(null=True, blank=True)

    @property
    def is_profile_complete(self):
        return bool(
            (self.service_location or "").strip()
            and (self.contact_email or "").strip()
            and (self.contact_phone or "").strip()
        )

    @property
    def profile_status(self):
        return "complete" if self.is_profile_complete else "incomplete"

    @property
    def languages_display(self):
        items = self.languages or []
        return ", ".join([str(x).strip() for x in items if str(x).strip()])

    @property
    def member_since_label(self):
        if not self.user or not self.user.date_joined:
            return ""
        joined = self.user.date_joined
        now = timezone.now()
        if (now - joined).days < 365:
            return joined.strftime("%b %Y")
        return joined.strftime("%Y")

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


class ProfileSave(models.Model):
    saver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile_saves_given",
    )
    saved_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile_saves_received",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["saver", "saved_user"],
                name="unique_profile_save",
            )
        ]

    def __str__(self):
        return f"{self.saver_id} saved {self.saved_user_id}"

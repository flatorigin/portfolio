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


def homeowner_reference_upload_path(instance, filename):
    return f"homeowner_references/user_{instance.user_id}/{filename}"
    
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
    public_profile_enabled = models.BooleanField(default=False)
    
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

    # Moderation. Frozen profiles keep all data but are hidden from public
    # discovery until an admin unfreezes them.
    is_frozen = models.BooleanField(default=False)
    frozen_at = models.DateTimeField(null=True, blank=True)
    frozen_reason = models.TextField(blank=True, default="")

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

    def save(self, *args, **kwargs):
        if self.is_frozen and not self.frozen_at:
            self.frozen_at = timezone.now()
        if not self.is_frozen:
            self.frozen_at = None
        super().save(*args, **kwargs)

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


class HomeownerReferenceImage(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="homeowner_reference_images",
    )
    image = models.ImageField(upload_to=homeowner_reference_upload_path)
    caption = models.CharField(max_length=160, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    order = models.PositiveIntegerField(default=0)
    is_public = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "-created_at", "-id"]

    def __str__(self):
        return f"HomeownerReferenceImage<{self.user_id}:{self.id}>"


class AIConfiguration(models.Model):
    enabled = models.BooleanField(default=False)
    project_helper_enabled = models.BooleanField(default=True)
    bid_helper_enabled = models.BooleanField(default=True)
    profile_helper_enabled = models.BooleanField(default=True)
    daily_limit_per_user = models.PositiveIntegerField(default=10)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_config_updates",
    )

    class Meta:
        verbose_name = "AI configuration"
        verbose_name_plural = "AI configuration"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "AI configuration"


class AIUsageEvent(models.Model):
    class Feature(models.TextChoices):
        PROJECT_SUMMARY = "project_summary", "Project summary"
        PROJECT_CHECKLIST = "project_checklist", "Project checklist"
        BID_PROPOSAL = "bid_proposal", "Bid proposal"
        PROFILE_HEADLINE = "profile_headline", "Profile headline"
        PROFILE_BLURB = "profile_blurb", "Profile blurb"
        PROFILE_BIO = "profile_bio", "Profile bio"

    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        REJECTED = "rejected", "Rejected"
        ERROR = "error", "Error"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ai_usage_events",
    )
    feature = models.CharField(max_length=40, choices=Feature.choices)
    model_name = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUCCESS)
    prompt_chars = models.PositiveIntegerField(default=0)
    response_chars = models.PositiveIntegerField(default=0)
    request_day = models.DateField(default=timezone.localdate, db_index=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"AIUsageEvent<{self.user_id}:{self.feature}:{self.status}>"

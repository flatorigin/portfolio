# backend/accounts/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


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

    class VerificationStatus(models.TextChoices):
        UNVERIFIED = "unverified", "Unverified"
        PENDING = "pending", "Pending review"
        VERIFIED = "verified", "Reviewed"
        REJECTED = "rejected", "Rejected"
        EXPIRED = "expired", "Review expired"

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
    service_lat = models.FloatField(blank=True, null=True)
    service_lng = models.FloatField(blank=True, null=True)

    # About
    bio = models.TextField(blank=True, default="")

    # Optional contact info (NEW)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=50, blank=True, default="")

    show_contact_email = models.BooleanField(default=False)
    show_contact_phone = models.BooleanField(default=False)
    public_profile_enabled = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    
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
    ai_daily_limit_override = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Optional per-user override for the daily AI assist limit. Leave blank to use the global default.",
    )

    license_number = models.CharField(max_length=120, blank=True, default="")
    license_state = models.CharField(max_length=80, blank=True, default="")
    insurance_provider = models.CharField(max_length=160, blank=True, default="")
    insurance_policy_number = models.CharField(max_length=120, blank=True, default="")
    insurance_expires_at = models.DateField(null=True, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.UNVERIFIED,
    )
    verification_submitted_at = models.DateTimeField(null=True, blank=True)
    verification_reviewed_at = models.DateTimeField(null=True, blank=True)
    verification_review_due_at = models.DateField(null=True, blank=True)
    verification_expires_at = models.DateField(null=True, blank=True)
    verification_notes = models.TextField(blank=True, default="")
    is_deactivated = models.BooleanField(default=False)
    deactivated_at = models.DateTimeField(null=True, blank=True)

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
    def is_email_verified(self):
        return bool(self.email_verified_at)

    @property
    def is_publicly_hidden(self):
        return bool(self.is_frozen or self.is_deactivated)

    @property
    def has_verification_submission(self):
        return bool(
            (self.license_number or "").strip()
            or (self.license_state or "").strip()
            or (self.insurance_provider or "").strip()
            or (self.insurance_policy_number or "").strip()
            or self.insurance_expires_at
        )

    @property
    def effective_verification_status(self):
        status = self.verification_status or self.VerificationStatus.UNVERIFIED
        today = timezone.localdate()
        if status == self.VerificationStatus.VERIFIED and self.verification_expires_at and self.verification_expires_at < today:
            return self.VerificationStatus.EXPIRED
        if status == self.VerificationStatus.UNVERIFIED and self.has_verification_submission:
            return self.VerificationStatus.PENDING
        return status

    @property
    def verification_badge_label(self):
        status = self.effective_verification_status
        if self.profile_type != self.ProfileType.CONTRACTOR:
            return ""
        if status == self.VerificationStatus.VERIFIED:
            return "Credentials reviewed"
        if status == self.VerificationStatus.PENDING:
            return "Review pending"
        if status == self.VerificationStatus.EXPIRED:
            return "Review expired"
        return ""

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
        if self.is_deactivated and not self.deactivated_at:
            self.deactivated_at = timezone.now()
        if not self.is_deactivated:
            self.deactivated_at = None
        if self.profile_type != self.ProfileType.CONTRACTOR:
            self.license_number = ""
            self.license_state = ""
            self.insurance_provider = ""
            self.insurance_policy_number = ""
            self.insurance_expires_at = None
            self.verification_status = self.VerificationStatus.UNVERIFIED
            self.verification_submitted_at = None
            self.verification_reviewed_at = None
            self.verification_review_due_at = None
            self.verification_expires_at = None
            self.verification_notes = ""
        elif self.has_verification_submission and not self.verification_submitted_at:
            self.verification_submitted_at = timezone.now()
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
        PLANNER_ANALYZE = "planner_analyze", "Planner issue analysis"
        PLANNER_OPTIONS = "planner_options", "Planner solution paths"
        PLANNER_DRAFT = "planner_draft", "Planner draft generation"

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


class DeletedEmailBlocklist(models.Model):
    email = models.EmailField(unique=True)
    reason = models.CharField(max_length=120, blank=True, default="deleted_account")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.email


class BusinessDirectoryListing(models.Model):
    business_name = models.CharField(max_length=255)
    location = models.CharField(max_length=200, blank=True, default="")
    specialties = models.JSONField(blank=True, default=list)
    phone_number = models.CharField(max_length=50, blank=True, default="")
    website = models.URLField(blank=True, default="")
    is_published = models.BooleanField(default=False)
    is_removed = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["business_name", "id"]

    def __str__(self):
        return self.business_name


class BusinessDirectoryListingLike(models.Model):
    liker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="business_directory_likes_given",
    )
    listing = models.ForeignKey(
        BusinessDirectoryListing,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["liker", "listing"],
                name="unique_business_directory_listing_like",
            )
        ]

    def __str__(self):
        return f"{self.liker_id} liked directory listing {self.listing_id}"


class StaffAccess(models.Model):
    class Role(models.TextChoices):
        SUPPORT = "support", "Support"
        MODERATOR = "moderator", "Moderator"
        COMPLIANCE = "compliance", "Compliance"
        SUPERADMIN = "superadmin", "Superadmin"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="staff_access",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SUPPORT)
    can_access_admin = models.BooleanField(default=False)
    can_manage_accounts = models.BooleanField(default=False)
    can_manage_moderation = models.BooleanField(default=False)
    can_manage_verification = models.BooleanField(default=False)
    can_manage_compliance = models.BooleanField(default=False)
    require_password_reset = models.BooleanField(default=False)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="staff_access_reviews",
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username", "user__email", "id"]
        verbose_name = "Staff access"
        verbose_name_plural = "Staff access"

    def __str__(self):
        return f"StaffAccess<{self.user_id}:{self.role}>"


def user_can_access_admin(user):
    if not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "is_active", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    if not getattr(user, "is_staff", False):
        return False

    access = getattr(user, "staff_access", None)
    if access is None:
        return False
    return bool(access.can_access_admin and not access.require_password_reset)


class UserReport(models.Model):
    class ReportType(models.TextChoices):
        SAFETY = "safety", "Safety"
        FRAUD = "fraud", "Fraud"
        IMPERSONATION = "impersonation", "Impersonation"
        HARASSMENT = "harassment", "Harassment"
        SPAM = "spam", "Spam"
        COPYRIGHT = "copyright", "Copyright"
        CHILD_SAFETY = "child_safety", "Child safety"
        ILLEGAL_CONTENT = "illegal_content", "Illegal content"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_REVIEW = "in_review", "In review"
        ESCALATED = "escalated", "Escalated"
        RESOLVED = "resolved", "Resolved"
        REJECTED = "rejected", "Rejected"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="submitted_reports",
    )
    target_content_type = models.ForeignKey(
        ContentType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reported_items",
    )
    target_object_id = models.PositiveBigIntegerField(null=True, blank=True)
    target_object = GenericForeignKey("target_content_type", "target_object_id")
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports_against_user",
    )
    report_type = models.CharField(max_length=32, choices=ReportType.choices, default=ReportType.OTHER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    subject = models.CharField(max_length=200, blank=True, default="")
    details = models.TextField(blank=True, default="")
    source_url = models.URLField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_user_reports",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"UserReport<{self.id}:{self.report_type}:{self.status}>"


class ModerationAction(models.Model):
    class ActionType(models.TextChoices):
        WARN_USER = "warn_user", "Warn user"
        FREEZE_PROFILE = "freeze_profile", "Freeze profile"
        UNFREEZE_PROFILE = "unfreeze_profile", "Unfreeze profile"
        DEACTIVATE_ACCOUNT = "deactivate_account", "Deactivate account"
        REACTIVATE_ACCOUNT = "reactivate_account", "Reactivate account"
        HIDE_CONTENT = "hide_content", "Hide content"
        RESTORE_CONTENT = "restore_content", "Restore content"
        REMOVE_CONTENT = "remove_content", "Remove content"
        DISABLE_DIRECT_MESSAGES = "disable_direct_messages", "Disable direct messages"
        ENABLE_DIRECT_MESSAGES = "enable_direct_messages", "Enable direct messages"
        MARK_VERIFIED = "mark_verified", "Mark verified"
        REJECT_VERIFICATION = "reject_verification", "Reject verification"
        COPYRIGHT_TAKEDOWN = "copyright_takedown", "Copyright takedown"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderation_actions_taken",
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderation_actions_received",
    )
    report = models.ForeignKey(
        UserReport,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderation_actions",
    )
    target_content_type = models.ForeignKey(
        ContentType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="moderation_actions",
    )
    target_object_id = models.PositiveBigIntegerField(null=True, blank=True)
    target_object = GenericForeignKey("target_content_type", "target_object_id")
    action_type = models.CharField(max_length=40, choices=ActionType.choices)
    public_note = models.TextField(blank=True, default="")
    internal_note = models.TextField(blank=True, default="")
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"ModerationAction<{self.id}:{self.action_type}>"


class AdminAuditLog(models.Model):
    class EventType(models.TextChoices):
        ADMIN_LOGIN = "admin_login", "Admin login"
        ADMIN_ACCESS_DENIED = "admin_access_denied", "Admin access denied"
        STAFF_ACCESS_UPDATED = "staff_access_updated", "Staff access updated"
        REPORT_UPDATED = "report_updated", "Report updated"
        MODERATION_ACTION = "moderation_action", "Moderation action"
        PROFILE_UPDATED = "profile_updated", "Profile updated"
        USER_UPDATED = "user_updated", "User updated"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="admin_audit_logs",
    )
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="admin_events_about_user",
    )
    target_content_type = models.ForeignKey(
        ContentType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="admin_audit_logs",
    )
    target_object_id = models.PositiveBigIntegerField(null=True, blank=True)
    target_object = GenericForeignKey("target_content_type", "target_object_id")
    summary = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"AdminAuditLog<{self.id}:{self.event_type}>"


def resolve_ai_daily_limit_for_user(user, config=None):
    config = config or AIConfiguration.get_solo()
    profile = getattr(user, "profile", None)
    if profile is None and user is not None:
        profile, _ = Profile.objects.get_or_create(user=user)

    override = getattr(profile, "ai_daily_limit_override", None)
    if override is not None:
        return int(override)

    fallback = int(getattr(config, "daily_limit_per_user", 0) or 0)
    if fallback <= 0:
        return int(getattr(settings, "AI_DAILY_LIMIT_PER_USER", 10))
    return fallback


def get_ai_remaining_today_for_user(user, config=None):
    config = config or AIConfiguration.get_solo()
    limit = resolve_ai_daily_limit_for_user(user, config=config)
    used = AIUsageEvent.objects.filter(
        user=user,
        request_day=timezone.localdate(),
        status=AIUsageEvent.Status.SUCCESS,
    ).count()
    return max(0, limit - used), limit

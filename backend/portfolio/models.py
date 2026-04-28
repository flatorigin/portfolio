# backend/portfolio/models.py
from io import BytesIO
import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone
from PIL import Image, UnidentifiedImageError

from .utils import convert_field_file_to_webp

try:
    from pillow_heif import register_heif_opener
except ImportError:
    register_heif_opener = None

if register_heif_opener:
    register_heif_opener()

User = get_user_model()


# -------------------------------------------------------------------
# Upload paths (keep stable if you already have migrations/files)
# -------------------------------------------------------------------
def direct_message_upload_path(instance, filename):
    # legacy helper (kept for backward compat if used in old migrations)
    return os.path.join("direct_messages", filename)


def project_cover_upload_path(instance, filename):
    # legacy helper (kept for backward compat if used in old migrations)
    return f"projects/{instance.owner_id}/{instance.id or 'new'}/cover/{filename}"


def project_image_upload_path(instance, filename):
    # legacy helper (kept for backward compat if used in old migrations)
    return f"projects/{instance.project.owner_id}/{instance.project_id}/images/{filename}"


def project_plan_image_upload_path(instance, filename):
    return f"project_plans/{instance.project_plan.owner_id}/{instance.project_plan_id}/images/{filename}"


def message_attachment_upload_path(instance, filename):
    thread = instance.message.thread
    project_part = thread.project_id or "direct"
    return f"messages/{thread.owner_id}/{project_part}/{thread.client_id}/{filename}"

def project_bid_attachment_upload_path(instance, filename):
    project_id = instance.bid.project_id or "project"
    contractor_id = instance.bid.contractor_id or "contractor"
    return f"project_bids/{project_id}/{contractor_id}/{filename}"

# -------------------------------------------------------------------
# Portfolio models
# -------------------------------------------------------------------
class Project(models.Model):
    # Cover convention:
    # - primary cover is first ProjectImage by order=0 (your serializer uses this)
    # - optional cover_image_ref and cover_image_file are supported as well
    cover_image_ref = models.ForeignKey(
        "ProjectImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cover_for_projects",
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
    )

    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)

    is_job_posting = models.BooleanField(default=False)
    is_private = models.BooleanField(default=False)

    # --- Job posting extensions (persisted) ---
    job_summary = models.TextField(blank=True, default="")
    job_is_published = models.BooleanField(default=False)

    service_categories = models.JSONField(blank=True, default=list)
    part_of_larger_project = models.BooleanField(default=False)
    larger_project_details = models.CharField(max_length=255, blank=True, default="")

    required_expertise = models.CharField(
        max_length=20,
        blank=True,
        default="",
        choices=[
            ("licensed_pro", "Licensed Professional"),
            ("handyman", "Handyman / Expert Help"),
        ],
    )

    permit_required = models.BooleanField(default=False)
    permit_responsible_party = models.CharField(
        max_length=20,
        blank=True,
        default="",
        choices=[
            ("contractor", "Contractor handles filing"),
            ("homeowner", "Homeowner handles filing"),
        ],
    )

    compliance_confirmed = models.BooleanField(default=False)

    post_privacy = models.CharField(
        max_length=10,
        blank=True,
        default="public",
        choices=[("public", "Public"), ("private", "Private")],
    )

    private_contractor_username = models.CharField(max_length=150, blank=True, default="")
    notify_by_email = models.BooleanField(default=False)

    # Optional separate cover file (fallback)
    cover_image_file = models.ImageField(
        upload_to="projects/covers/",
        blank=True,
        null=True,
    )

    is_public = models.BooleanField(default=True)
    tech_stack = models.JSONField(blank=True, null=True)

    location = models.CharField(max_length=140, blank=True, default="")
    budget = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    sqf = models.IntegerField(blank=True, null=True)
    highlights = models.TextField(blank=True, default="")

    material_url = models.URLField(blank=True, null=True)
    material_label = models.CharField(
        max_length=255,
        blank=True,
        help_text="Short title/description for the material/tool (e.g. 'DeWalt Drill – $129').",
        null=True,
    )

    extra_links = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.owner})"

    def save(self, *args, **kwargs):
        if self.cover_image_file and hasattr(self.cover_image_file, "file"):
            convert_field_file_to_webp(self.cover_image_file, quality=80)
        super().save(*args, **kwargs)

    @property
    def is_private_job(self):
        return bool(self.is_job_posting and (self.is_private or self.post_privacy == "private"))


class ProjectPlan(models.Model):
    STATUS_PLANNING = "planning"
    STATUS_READY_TO_DRAFT = "ready_to_draft"
    STATUS_CONVERTED = "converted"
    STATUS_ARCHIVED = "archived"
    STATUS_CHOICES = [
        (STATUS_PLANNING, "Planning"),
        (STATUS_READY_TO_DRAFT, "Ready to draft"),
        (STATUS_CONVERTED, "Converted"),
        (STATUS_ARCHIVED, "Archived"),
    ]

    PRIORITY_LOW = "low"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_HIGH = "high"
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, "Low"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_HIGH, "High"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_plans",
    )
    title = models.CharField(max_length=255, blank=True, default="Untitled issue")
    issue_summary = models.TextField(blank=True, default="")
    house_location = models.CharField(max_length=140, blank=True, default="")
    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_CHOICES,
        blank=True,
        default=PRIORITY_MEDIUM,
    )
    budget_min = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    budget_max = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    notes = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PLANNING,
    )
    visibility = models.CharField(max_length=20, default="private")
    contractor_types = models.JSONField(blank=True, default=list)
    links = models.JSONField(blank=True, default=list)
    options = models.JSONField(blank=True, default=list)
    selected_option_key = models.CharField(max_length=80, blank=True, default="")
    ai_generated_issue_summary = models.TextField(blank=True, default="")
    ai_suggested_contractor_types = models.JSONField(blank=True, default=list)
    converted_job_post = models.ForeignKey(
        "portfolio.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_project_plans",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"ProjectPlan<{self.owner_id}:{self.title or 'Untitled issue'}>"


class ProjectPlanImage(models.Model):
    project_plan = models.ForeignKey(
        ProjectPlan,
        related_name="images",
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to=project_plan_image_upload_path)
    caption = models.CharField(max_length=255, blank=True, default="")
    order = models.PositiveIntegerField(default=0)
    is_cover = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def _convert_image_to_webp(self):
        if not self.image:
            return

        current_name = self.image.name
        root, ext = os.path.splitext((current_name or "").lower())
        if ext == ".webp":
            return

        try:
            img = Image.open(self.image)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")

            buffer = BytesIO()
            img.save(buffer, format="WEBP", quality=80)
            buffer.seek(0)
        except (UnidentifiedImageError, OSError, ValueError):
            try:
                self.image.seek(0)
            except Exception:
                pass
            return

        new_name = f"{root}.webp"
        old_name = current_name
        self.image.save(new_name, ContentFile(buffer.read()), save=False)

        if old_name and old_name != self.image.name and default_storage.exists(old_name):
            try:
                default_storage.delete(old_name)
            except Exception:
                pass

    def save(self, *args, **kwargs):
        if self.image and not getattr(self.image, "_committed", True):
            self._convert_image_to_webp()
        super().save(*args, **kwargs)


class ProjectFavorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_favorites",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="favorites",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "project")

    def __str__(self):
        return f"{self.user} → {self.project}"


class ProjectLike(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_likes",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="likes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "project")

    def __str__(self):
        return f"{self.user} ♥ {self.project}"


class ProjectInvite(models.Model):
    STATUS_INVITED = "invited"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"

    STATUS_CHOICES = [
        (STATUS_INVITED, "Invited"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
    ]

    project = models.ForeignKey(
        "portfolio.Project",
        related_name="invites",
        on_delete=models.CASCADE,
    )
    contractor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="project_invites",
        on_delete=models.CASCADE,
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_INVITED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "contractor"],
                name="unique_project_invite_per_contractor",
            )
        ]

    def __str__(self):
        return f"Invite {self.project_id} -> {self.contractor_id} ({self.status})"


class ProjectComment(models.Model):
    project = models.ForeignKey(
        "portfolio.Project",
        related_name="comments",
        on_delete=models.CASCADE,
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="project_comments",
        on_delete=models.CASCADE,
    )
    rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )

    is_testimonial = models.BooleanField(default=False)
    testimonial_published = models.BooleanField(default=False)
    testimonial_published_at = models.DateTimeField(null=True, blank=True)

    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Comment by {self.author} on {self.project} ({self.created_at:%Y-%m-%d})"


class ProjectImage(models.Model):
    project = models.ForeignKey(
        Project,
        related_name="images",
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to="project_images/")
    caption = models.CharField(max_length=255, blank=True)
    alt_text = models.CharField(max_length=255, blank=True)
    extra_data = models.JSONField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def _convert_image_to_webp(self):
        if not self.image:
            return

        current_name = self.image.name
        root, ext = os.path.splitext((current_name or "").lower())

        if ext == ".webp":
            return

        try:
            img = Image.open(self.image)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")

            buffer = BytesIO()
            img.save(buffer, format="WEBP", quality=80)
            buffer.seek(0)
        except (UnidentifiedImageError, OSError, ValueError):
            try:
                self.image.seek(0)
            except Exception:
                pass
            return

        new_name = f"{root}.webp"
        old_name = current_name

        self.image.save(new_name, ContentFile(buffer.read()), save=False)

        if old_name and old_name != self.image.name and default_storage.exists(old_name):
            try:
                default_storage.delete(old_name)
            except Exception:
                pass

    def save(self, *args, **kwargs):
        if self.image and not getattr(self.image, "_committed", True):
            self._convert_image_to_webp()
        super().save(*args, **kwargs)

class ProjectBid(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_SUBMITTED = "submitted"
    STATUS_REVISED = "revised"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_WITHDRAWN = "withdrawn"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_REVISED, "Revised"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_WITHDRAWN, "Withdrawn"),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="legacy_project_bids",
    )
    contractor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_bids",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
    )

    accepted_version = models.ForeignKey(
        "ProjectBidVersion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="accepted_for_bids",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "contractor"],
                name="unique_project_bid_per_contractor",
            )
        ]
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Bid<{self.id}> project={self.project_id} contractor={self.contractor_id}"

    @property
    def latest_version(self):
        return self.versions.order_by("-version_number", "-id").first()

    def next_version_number(self):
        latest = self.latest_version
        return (latest.version_number + 1) if latest else 1


class ProjectBidVersion(models.Model):
    PRICE_TYPE_FIXED = "fixed"
    PRICE_TYPE_RANGE = "range"

    PRICE_TYPE_CHOICES = [
        (PRICE_TYPE_FIXED, "Fixed price"),
        (PRICE_TYPE_RANGE, "Estimate range"),
    ]

    bid = models.ForeignKey(
        ProjectBid,
        on_delete=models.CASCADE,
        related_name="versions",
    )

    version_number = models.PositiveIntegerField()

    price_type = models.CharField(
        max_length=20,
        choices=PRICE_TYPE_CHOICES,
        default=PRICE_TYPE_FIXED,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    amount_min = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    amount_max = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    timeline_text = models.CharField(max_length=255, blank=True, default="")
    proposal_text = models.TextField(blank=True, default="")
    included_text = models.TextField(blank=True, default="")
    excluded_text = models.TextField(blank=True, default="")
    payment_terms = models.TextField(blank=True, default="")

    valid_until = models.DateField(null=True, blank=True)

    attachment = models.FileField(
        upload_to=project_bid_attachment_upload_path,
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_bid_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["bid", "version_number"],
                name="unique_bid_version_number",
            )
        ]
        ordering = ["-version_number", "-id"]

    def __str__(self):
        return f"BidVersion<{self.id}> bid={self.bid_id} v{self.version_number}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.price_type == self.PRICE_TYPE_FIXED:
            if self.amount is None:
                raise ValidationError({"amount": "Amount is required for a fixed-price bid."})
            if self.amount_min is not None or self.amount_max is not None:
                raise ValidationError(
                    {"price_type": "Use amount only for a fixed-price bid."}
                )

        if self.price_type == self.PRICE_TYPE_RANGE:
            if self.amount_min is None or self.amount_max is None:
                raise ValidationError(
                    {"price_type": "Amount min and amount max are required for a range bid."}
                )
            if self.amount is not None:
                raise ValidationError(
                    {"price_type": "Use amount min/max only for a range bid."}
                )
            if self.amount_min > self.amount_max:
                raise ValidationError(
                    {"amount_max": "Amount max must be greater than or equal to amount min."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)



# -------------------------------------------------------------------
# Messaging
# -------------------------------------------------------------------
class MessageThread(models.Model):
    """
    Direct message thread between two users.

    - `project` is optional, used as origin project context
    - accept flags implement message requests
    - block flags implement blocking
    """

    project = models.ForeignKey(
        Project,
        related_name="message_threads",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="owned_threads",
        on_delete=models.CASCADE,
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="client_threads",
        on_delete=models.CASCADE,
    )

    owner_has_accepted = models.BooleanField(default=True)
    client_has_accepted = models.BooleanField(default=False)

    owner_archived = models.BooleanField(default=False)
    client_archived = models.BooleanField(default=False)

    owner_blocked_client = models.BooleanField(default=False)
    client_blocked_owner = models.BooleanField(default=False)

    owner_ignored_until = models.DateTimeField(null=True, blank=True)
    client_ignored_until = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "client"], name="unique_dm_pair")
        ]

    def __str__(self):
        return f"DM<{self.id}> users={self.owner_id},{self.client_id}"

    @classmethod
    def normalize_users(cls, u1, u2):
        if u1.id < u2.id:
            return u1, u2
        return u2, u1

    @classmethod
    def get_or_create_dm(cls, u1, u2, *, origin_project=None, initiated_by=None):
        if u1 == u2:
            raise ValueError("Cannot create a DM thread with yourself.")

        owner, client = cls.normalize_users(u1, u2)
        thread, created = cls.objects.get_or_create(owner=owner, client=client)

        changed = False

        if origin_project and thread.project_id is None:
            thread.project = origin_project
            changed = True

        if initiated_by is not None and created:
            if initiated_by == owner:
                thread.owner_has_accepted = True
                thread.client_has_accepted = False
                changed = True
            elif initiated_by == client:
                thread.client_has_accepted = True
                thread.owner_has_accepted = False
                changed = True

        if changed or created:
            thread.save()

        return thread, created

    def user_is_participant(self, user):
        return bool(user and user.id in (self.owner_id, self.client_id))

    def is_blocked_for(self, user):
        uid = getattr(user, "id", None)
        if uid == self.owner_id:
            return self.owner_blocked_client or self.client_blocked_owner
        if uid == self.client_id:
            return self.client_blocked_owner or self.owner_blocked_client
        return True

    def user_has_accepted(self, user):
        uid = getattr(user, "id", None)
        if uid == self.owner_id:
            return self.owner_has_accepted
        if uid == self.client_id:
            return self.client_has_accepted
        return False

    def mark_accepted(self, user):
        uid = getattr(user, "id", None)
        changed = False

        if uid == self.owner_id and not self.owner_has_accepted:
            self.owner_has_accepted = True
            self.owner_ignored_until = None
            changed = True
        elif uid == self.client_id and not self.client_has_accepted:
            self.client_has_accepted = True
            self.client_ignored_until = None
            changed = True

        if changed:
            self.save(
                update_fields=[
                    "owner_has_accepted",
                    "client_has_accepted",
                    "owner_ignored_until",
                    "client_ignored_until",
                ]
            )

    def block_other(self, user):
        uid = getattr(user, "id", None)
        if uid == self.owner_id and not self.owner_blocked_client:
            self.owner_blocked_client = True
            self.save(update_fields=["owner_blocked_client"])
        elif uid == self.client_id and not self.client_blocked_owner:
            self.client_blocked_owner = True
            self.save(update_fields=["client_blocked_owner"])

    def unblock_other(self, user):
        uid = getattr(user, "id", None)
        if uid == self.owner_id and self.owner_blocked_client:
            self.owner_blocked_client = False
            self.save(update_fields=["owner_blocked_client"])
        elif uid == self.client_id and self.client_blocked_owner:
            self.client_blocked_owner = False
            self.save(update_fields=["client_blocked_owner"])

    def ignored_until_for(self, user):
        if not user:
            return None
        if user.id == self.owner_id:
            return self.owner_ignored_until
        if user.id == self.client_id:
            return self.client_ignored_until
        return None

    def set_ignored_until(self, user, until_dt):
        if not user:
            return
        if user.id == self.owner_id:
            self.owner_ignored_until = until_dt
            self.save(update_fields=["owner_ignored_until"])
        elif user.id == self.client_id:
            self.client_ignored_until = until_dt
            self.save(update_fields=["client_ignored_until"])

    @property
    def latest_message(self):
        return self.messages.order_by("-created_at").first()

    def unread_count_for(self, user):
        return 0


class PrivateMessage(models.Model):
    thread = models.ForeignKey(
        MessageThread,
        related_name="messages",
        on_delete=models.CASCADE,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sent_messages",
        on_delete=models.CASCADE,
    )
    text = models.TextField(blank=True)

    # legacy single attachment support
    attachment = models.FileField(
        upload_to=direct_message_upload_path,
        blank=True,
        null=True,
    )
    attachment_name = models.CharField(max_length=255, blank=True, default="")
    attachment_type = models.CharField(max_length=50, blank=True, default="")

    # threaded reply support
    parent_message = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="replies",
    )
    context_project = models.ForeignKey(
        Project,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="context_messages",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Message<{self.id}> in thread {self.thread_id}"


class MessageAttachment(models.Model):
    KIND_CHOICES = [
        ("image", "Image"),
        ("document", "Document"),
        ("camera", "Camera"),
        ("link", "Link"),
    ]

    message = models.ForeignKey(
        PrivateMessage,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    file = models.FileField(upload_to=message_attachment_upload_path, blank=True, null=True)
    original_name = models.CharField(max_length=255, blank=True, default="")
    url = models.URLField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.kind} -> message {self.message_id}"

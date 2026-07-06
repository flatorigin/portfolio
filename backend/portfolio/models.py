# backend/portfolio/models.py
from io import BytesIO
import os
import subprocess
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.mail import send_mail
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError

from .utils import convert_field_file_to_webp

try:
    from pillow_heif import register_heif_opener
except ImportError:
    register_heif_opener = None

if register_heif_opener:
    register_heif_opener()

User = get_user_model()

IMAGE_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
VIDEO_UPLOAD_EXTENSIONS = {".mp4", ".mov", ".webm"}


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

def feedback_attachment_upload_path(instance, filename):
    ticket_id = instance.ticket_id or "new"
    user_id = getattr(instance.ticket, "user_id", "unknown")
    return f"feedback_attachments/{user_id}/{ticket_id}/{filename}"

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

    CONTRACTOR_READY_NOT_READY = "not_ready"
    CONTRACTOR_READY_NEEDS_MORE = "needs_more_info"
    CONTRACTOR_READY_READY = "ready_for_estimate"
    CONTRACTOR_READY_STATUS_CHOICES = [
        (CONTRACTOR_READY_NOT_READY, "Not ready"),
        (CONTRACTOR_READY_NEEDS_MORE, "Needs more info"),
        (CONTRACTOR_READY_READY, "Ready for estimate"),
    ]

    VISIBILITY_DRAFT = "draft"
    VISIBILITY_LOCAL_PUBLIC = "local_public"
    VISIBILITY_INVITE_ONLY = "invite_only"
    VISIBILITY_PRIVATE = "private"
    VISIBILITY_STATUS_CHOICES = [
        (VISIBILITY_DRAFT, "Draft"),
        (VISIBILITY_LOCAL_PUBLIC, "Local Public"),
        (VISIBILITY_INVITE_ONLY, "Invite Only"),
        (VISIBILITY_PRIVATE, "Private"),
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
    project_type = models.CharField(max_length=40, blank=True, default="")
    visibility = models.CharField(max_length=20, default="private")
    visibility_status = models.CharField(
        max_length=20,
        choices=VISIBILITY_STATUS_CHOICES,
        default=VISIBILITY_DRAFT,
    )
    guided_answers_json = models.JSONField(blank=True, default=dict)
    guided_question_index = models.PositiveSmallIntegerField(default=0)
    site_access = models.CharField(max_length=255, blank=True, default="")
    contractor_types = models.JSONField(blank=True, default=list)
    links = models.JSONField(blank=True, default=list)
    options = models.JSONField(blank=True, default=list)
    markup_data = models.JSONField(blank=True, default=dict)
    selected_option_key = models.CharField(max_length=80, blank=True, default="")
    ai_generated_issue_summary = models.TextField(blank=True, default="")
    ai_suggested_contractor_types = models.JSONField(blank=True, default=list)
    contractor_ready_summary_json = models.JSONField(blank=True, default=dict)
    contractor_ready_status = models.CharField(
        max_length=24,
        choices=CONTRACTOR_READY_STATUS_CHOICES,
        default=CONTRACTOR_READY_NOT_READY,
    )
    project_readiness_score = models.PositiveSmallIntegerField(default=0)
    ai_generated_at = models.DateTimeField(null=True, blank=True)
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
            img = ImageOps.exif_transpose(img)
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
    MEDIA_TYPE_IMAGE = "image"
    MEDIA_TYPE_VIDEO = "video"
    MEDIA_TYPE_CHOICES = (
        (MEDIA_TYPE_IMAGE, "Image"),
        (MEDIA_TYPE_VIDEO, "Video"),
    )

    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_READY = "ready"
    STATUS_FAILED = "failed"
    PROCESSING_STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_READY, "Ready"),
        (STATUS_FAILED, "Failed"),
    )

    project = models.ForeignKey(
        Project,
        related_name="images",
        on_delete=models.CASCADE,
    )
    image = models.ImageField(upload_to="project_images/")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES, default=MEDIA_TYPE_IMAGE)
    thumbnail = models.ImageField(upload_to="project_images/thumbnails/", blank=True, null=True)
    processing_status = models.CharField(
        max_length=20,
        choices=PROCESSING_STATUS_CHOICES,
        default=STATUS_READY,
    )
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
            self.media_type = self.MEDIA_TYPE_IMAGE
            self.processing_status = self.STATUS_READY
            return

        try:
            img = Image.open(self.image)
            img = ImageOps.exif_transpose(img)
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
            self.processing_status = self.STATUS_FAILED
            return

        new_name = f"{root}.webp"
        old_name = current_name

        self.image.save(new_name, ContentFile(buffer.read()), save=False)
        self.media_type = self.MEDIA_TYPE_IMAGE
        self.processing_status = self.STATUS_READY

        if old_name and old_name != self.image.name and default_storage.exists(old_name):
            try:
                default_storage.delete(old_name)
            except Exception:
                pass

    def _convert_video_to_webm(self):
        if not self.image:
            return

        current_name = self.image.name
        root, ext = os.path.splitext((current_name or "").lower())

        self.media_type = self.MEDIA_TYPE_VIDEO
        self.processing_status = self.STATUS_PROCESSING

        suffix = ext if ext in VIDEO_UPLOAD_EXTENSIONS else ".video"
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = Path(tmpdir) / f"input{suffix}"
            output_path = Path(tmpdir) / "output.webm"
            thumb_path = Path(tmpdir) / "thumbnail.png"

            try:
                with open(input_path, "wb") as handle:
                    for chunk in self.image.chunks():
                        handle.write(chunk)

                subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-i",
                        str(input_path),
                        "-vf",
                        "scale=min(1280\\,iw):-2",
                        "-c:v",
                        "libvpx-vp9",
                        "-b:v",
                        "0",
                        "-crf",
                        "34",
                        "-c:a",
                        "libopus",
                        "-b:a",
                        "96k",
                        str(output_path),
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                )

                subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-i",
                        str(output_path),
                        "-frames:v",
                        "1",
                        "-update",
                        "1",
                        str(thumb_path),
                    ],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                )

                old_name = current_name
                new_name = f"{root}.webm"
                self.image.save(new_name, ContentFile(output_path.read_bytes()), save=False)
                self.thumbnail.save(f"{root}_thumb.png", ContentFile(thumb_path.read_bytes()), save=False)
                self.processing_status = self.STATUS_READY

                if old_name and old_name != self.image.name and default_storage.exists(old_name):
                    try:
                        default_storage.delete(old_name)
                    except Exception:
                        pass
            except Exception:
                try:
                    self.image.seek(0)
                except Exception:
                    pass
                self.processing_status = self.STATUS_FAILED

    def save(self, *args, **kwargs):
        if self.image and not getattr(self.image, "_committed", True):
            ext = os.path.splitext((self.image.name or "").lower())[1]
            content_type = str(getattr(self.image, "content_type", "") or "").lower()
            if (
                self.media_type == self.MEDIA_TYPE_VIDEO
                or ext in VIDEO_UPLOAD_EXTENSIONS
                or content_type.startswith("video/")
            ):
                self._convert_video_to_webm()
            else:
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


class HelperListing(models.Model):
    SKILL_GENERAL_LABOR = "general_labor"
    SKILL_DEMOLITION = "demolition"
    SKILL_CLEANUP = "cleanup"
    SKILL_PAINTING = "painting"
    SKILL_LANDSCAPING = "landscaping"
    SKILL_FLOORING = "flooring"
    SKILL_DRYWALL = "drywall"
    SKILL_FRAMING = "framing"
    SKILL_DECKS = "decks"
    SKILL_CONCRETE = "concrete"
    SKILL_TILE = "tile"
    SKILL_CABINET_INSTALLATION = "cabinet_installation"
    SKILL_MOVING_MATERIALS = "moving_materials"
    SKILL_ROOFING_ASSISTANT = "roofing_assistant"
    SKILL_ELECTRICAL_ASSISTANT = "electrical_assistant"
    SKILL_PLUMBING_ASSISTANT = "plumbing_assistant"
    SKILL_OTHER = "other"
    SKILL_CHOICES = [
        (SKILL_GENERAL_LABOR, "General labor"),
        (SKILL_DEMOLITION, "Demolition"),
        (SKILL_CLEANUP, "Cleanup"),
        (SKILL_PAINTING, "Painting"),
        (SKILL_LANDSCAPING, "Landscaping"),
        (SKILL_FLOORING, "Flooring"),
        (SKILL_DRYWALL, "Drywall"),
        (SKILL_FRAMING, "Framing"),
        (SKILL_DECKS, "Decks"),
        (SKILL_CONCRETE, "Concrete"),
        (SKILL_TILE, "Tile"),
        (SKILL_CABINET_INSTALLATION, "Cabinet installation"),
        (SKILL_MOVING_MATERIALS, "Moving materials"),
        (SKILL_ROOFING_ASSISTANT, "Roofing assistant"),
        (SKILL_ELECTRICAL_ASSISTANT, "Electrical assistant"),
        (SKILL_PLUMBING_ASSISTANT, "Plumbing assistant"),
        (SKILL_OTHER, "Other"),
    ]
    SKILL_LABELS = dict(SKILL_CHOICES)

    AVAILABILITY_WEEKDAYS = "weekdays"
    AVAILABILITY_EVENINGS = "evenings"
    AVAILABILITY_WEEKENDS = "weekends"
    AVAILABILITY_PART_TIME = "part_time"
    AVAILABILITY_FULL_TIME = "full_time"
    AVAILABILITY_ONE_DAY_HELP = "one_day_help"
    AVAILABILITY_CHOICES = [
        (AVAILABILITY_WEEKDAYS, "Weekdays"),
        (AVAILABILITY_EVENINGS, "Evenings"),
        (AVAILABILITY_WEEKENDS, "Weekends"),
        (AVAILABILITY_PART_TIME, "Part-time"),
        (AVAILABILITY_FULL_TIME, "Full-time"),
        (AVAILABILITY_ONE_DAY_HELP, "One-day help"),
    ]
    AVAILABILITY_LABELS = dict(AVAILABILITY_CHOICES)

    EXPERIENCE_BEGINNER = "beginner"
    EXPERIENCE_1_3 = "1_3_years"
    EXPERIENCE_3_10 = "3_10_years"
    EXPERIENCE_10_PLUS = "10_plus_years"
    EXPERIENCE_CHOICES = [
        (EXPERIENCE_BEGINNER, "Beginner"),
        (EXPERIENCE_1_3, "1-3 years"),
        (EXPERIENCE_3_10, "3-10 years"),
        (EXPERIENCE_10_PLUS, "10+ years"),
    ]

    CONTACT_PHONE = "phone"
    CONTACT_EMAIL = "email"
    CONTACT_EITHER = "either"
    CONTACT_METHOD_CHOICES = [
        (CONTACT_PHONE, "Phone"),
        (CONTACT_EMAIL, "Email"),
        (CONTACT_EITHER, "Either"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="helper_listings",
        null=True,
        blank=True,
    )
    full_name = models.CharField(max_length=160)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    service_radius_miles = models.PositiveIntegerField(default=15)
    phone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    preferred_contact_method = models.CharField(
        max_length=10,
        choices=CONTACT_METHOD_CHOICES,
        default=CONTACT_EMAIL,
    )
    skills = models.JSONField(default=list, blank=True)
    other_skill = models.CharField(max_length=100, blank=True, default="")
    availability = models.JSONField(default=list, blank=True)
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_CHOICES)
    bio = models.CharField(max_length=300, blank=True, default="")
    is_active = models.BooleanField(default=True)
    admin_approved = models.BooleanField(default=False)
    contact_verified = models.BooleanField(default=False)
    contact_verified_at = models.DateTimeField(null=True, blank=True)
    verification_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    verification_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.full_name} - {self.city}, {self.state}"

    @property
    def is_publicly_visible(self):
        return bool(self.is_active and self.admin_approved and self.contact_verified)

    def skill_labels(self):
        return [self.SKILL_LABELS.get(skill, skill) for skill in self.skills or []]

    def availability_labels(self):
        return [
            self.AVAILABILITY_LABELS.get(item, item)
            for item in self.availability or []
        ]

    def send_verification_email(self, request=None):
        if not self.email:
            return False

        base_url = ""
        if request:
            base_url = request.build_absolute_uri("/")[:-1]
        else:
            base_url = getattr(settings, "FRONTEND_BASE_URL", "") or getattr(
                settings, "SITE_URL", ""
            )
        if not base_url:
            return False

        verify_url = f"{base_url}/project-helpers/verify/{self.verification_token}"
        subject = "Verify your Project Helpers listing"
        body = (
            "Please verify your contact email for your FlatOrigin Project Helpers listing.\n\n"
            f"Verify listing: {verify_url}\n\n"
            "Your listing will not appear publicly until contact verification and admin review are complete."
        )

        try:
            send_mail(
                subject,
                body,
                getattr(settings, "DEFAULT_FROM_EMAIL", None),
                [self.email],
                fail_silently=True,
            )
            self.verification_sent_at = timezone.now()
            self.save(update_fields=["verification_sent_at"])
            return True
        except Exception:
            return False


class HelperFeedback(models.Model):
    helper = models.ForeignKey(
        HelperListing,
        on_delete=models.CASCADE,
        related_name="feedback",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="helper_feedback",
    )
    project_type = models.CharField(max_length=120)
    worked_together = models.BooleanField(default=False)
    reliability_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    communication_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    work_quality_rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    would_hire_again = models.BooleanField(default=False)
    short_note = models.CharField(max_length=200, blank=True, default="")
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Feedback<{self.id}> helper={self.helper_id} reviewer={self.reviewer_id}"


class FeedbackTicket(models.Model):
    CATEGORY_GENERAL_FEEDBACK = "general_feedback"
    CATEGORY_TECHNICAL_SUPPORT = "technical_support"
    CATEGORY_COPYRIGHT_CONTENT_REPORT = "copyright_content_report"
    CATEGORY_CUSTOMER_SERVICE = "customer_service"
    CATEGORY_CHOICES = [
        (CATEGORY_GENERAL_FEEDBACK, "General Feedback"),
        (CATEGORY_TECHNICAL_SUPPORT, "Technical Support"),
        (CATEGORY_COPYRIGHT_CONTENT_REPORT, "Copyright & Content Report"),
        (CATEGORY_CUSTOMER_SERVICE, "Customer Service"),
    ]

    STATUS_NEW = "new"
    STATUS_WORK_IN_PROGRESS = "work_in_progress"
    STATUS_NEEDS_MORE_SUPPORTING_DOCUMENTS = "needs_more_supporting_documents"
    STATUS_RESOLVED = "resolved"
    STATUS_REMOVED = "removed"
    STATUS_CHOICES = [
        (STATUS_NEW, "New"),
        (STATUS_WORK_IN_PROGRESS, "Work in progress"),
        (STATUS_NEEDS_MORE_SUPPORTING_DOCUMENTS, "Needs more supporting documents"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_REMOVED, "Removed"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="feedback_tickets",
    )
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    links = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=40, choices=STATUS_CHOICES, default=STATUS_NEW)
    internal_admin_note = models.TextField(blank=True)
    resolved_notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"FeedbackTicket<{self.id}> {self.subject}"

    def _send_feedback_email(self, subject, body):
        recipient = getattr(self.user, "email", "") or ""
        if not recipient:
            return False
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)
        try:
            send_mail(subject, body, from_email, [recipient], fail_silently=True)
            return True
        except Exception:
            return False

    def _send_internal_email(self, subject, body):
        recipients = getattr(settings, "FEEDBACK_NOTIFICATION_EMAILS", None) or []
        if not recipients:
            single = str(getattr(settings, "FEEDBACK_NOTIFICATION_EMAIL", "") or "").strip()
            recipients = [single] if single else []
        recipients = [email for email in recipients if email]
        if not recipients:
            return False

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)
        try:
            send_mail(subject, body, from_email, recipients, fail_silently=True)
            return True
        except Exception:
            return False

    def send_submission_confirmation(self):
        return self._send_feedback_email(
            "We received your feedback",
            (
                "Thank you for your submission. The FlatOrigin team will review it "
                "and contact you if more information is needed."
            ),
        )

    def send_internal_submission_notification(self):
        link_lines = "\n".join(str(link) for link in (self.links or [])) or "None"
        body = (
            "A new Feedback & Support ticket was submitted.\n\n"
            f"Ticket ID: {self.id}\n"
            f"Category: {self.get_category_display()}\n"
            f"Status: {self.get_status_display()}\n"
            f"User: {getattr(self.user, 'username', '')} <{getattr(self.user, 'email', '')}>\n"
            f"Subject: {self.subject}\n\n"
            f"Message:\n{self.message}\n\n"
            f"Links:\n{link_lines}\n\n"
            "Review this ticket in Django Admin under Portfolio > Feedback tickets."
        )
        return self._send_internal_email(f"New FlatOrigin feedback: {self.subject}", body)

    def save(self, *args, **kwargs):
        previous_status = None
        if self.pk:
            previous_status = (
                FeedbackTicket.objects.filter(pk=self.pk)
                .values_list("status", flat=True)
                .first()
            )

        status_changed = previous_status is not None and previous_status != self.status
        should_notify_resolved = (
            status_changed
            and self.status == self.STATUS_RESOLVED
            and self.resolved_notified_at is None
        )
        should_notify_more_docs = (
            status_changed
            and self.status == self.STATUS_NEEDS_MORE_SUPPORTING_DOCUMENTS
        )

        if should_notify_resolved:
            self.resolved_notified_at = timezone.now()

        super().save(*args, **kwargs)

        if should_notify_resolved:
            self._send_feedback_email(
                "Your feedback has been resolved",
                (
                    "Thank you for contacting FlatOrigin. Your feedback has been "
                    "reviewed and marked as resolved."
                ),
            )
        elif should_notify_more_docs:
            self._send_feedback_email(
                "Additional information is needed",
                (
                    "Thank you for contacting FlatOrigin. Please provide more "
                    "supporting documents, screenshots, or clarification so we can "
                    "continue reviewing your request."
                ),
            )


class FeedbackAttachment(models.Model):
    ticket = models.ForeignKey(
        FeedbackTicket,
        related_name="attachments",
        on_delete=models.CASCADE,
    )
    reply = models.ForeignKey(
        "FeedbackReply",
        related_name="attachments",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    file = models.FileField(upload_to=feedback_attachment_upload_path)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at"]

    def __str__(self):
        return self.original_name or f"Feedback attachment {self.id}"


class FeedbackReply(models.Model):
    ticket = models.ForeignKey(
        FeedbackTicket,
        related_name="replies",
        on_delete=models.CASCADE,
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="feedback_replies",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    is_staff_reply = models.BooleanField(default=False)
    message = models.TextField()
    notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"FeedbackReply<{self.id}> ticket {self.ticket_id}"

    def send_created_notification(self):
        if self.is_staff_reply:
            sent = self.ticket._send_feedback_email(
                "FlatOrigin support replied to your ticket",
                (
                    "FlatOrigin support has replied to your feedback request.\n\n"
                    f"Subject: {self.ticket.subject}\n\n"
                    f"Reply:\n{self.message}"
                ),
            )
        else:
            sent = self.ticket._send_internal_email(
                f"New reply on FlatOrigin feedback: {self.ticket.subject}",
                (
                    "A user added a reply to a Feedback & Support ticket.\n\n"
                    f"Ticket ID: {self.ticket_id}\n"
                    f"User: {getattr(self.author, 'username', '')} <{getattr(self.author, 'email', '')}>\n"
                    f"Subject: {self.ticket.subject}\n\n"
                    f"Reply:\n{self.message}\n\n"
                    "Review this ticket in Django Admin under Portfolio > Feedback tickets."
                ),
            )

        if sent and self.notified_at is None:
            self.notified_at = timezone.now()
            FeedbackReply.objects.filter(pk=self.pk, notified_at__isnull=True).update(
                notified_at=self.notified_at
            )
        return sent

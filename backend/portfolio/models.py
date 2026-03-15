# backend/portfolio/models.py
from io import BytesIO
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from django.utils import timezone
from datetime import timedelta
from PIL import Image

from .utils import convert_field_file_to_webp

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

    # --- Job posting extensions (persisted) ---
    job_summary = models.TextField(blank=True, default="")

    # draft vs published for job posts
    job_is_published = models.BooleanField(default=False)

    service_categories = models.JSONField(blank=True, default=list)  # ["Plumbing", ...]
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
        # Convert cover_image_file to webp if present
        if self.cover_image_file and hasattr(self.cover_image_file, "file"):
            convert_field_file_to_webp(self.cover_image_file, quality=80)
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

        img = Image.open(self.image)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        buffer = BytesIO()
        img.save(buffer, format="WEBP", quality=80)
        buffer.seek(0)

        new_name = f"{root}.webp"
        old_name = current_name

        self.image.save(new_name, ContentFile(buffer.read()), save=False)

        if old_name and old_name != self.image.name and default_storage.exists(old_name):
            try:
                default_storage.delete(old_name)
            except Exception:
                pass

    def save(self, *args, **kwargs):
        if self.image and hasattr(self.image, "file"):
            self._convert_image_to_webp()
        super().save(*args, **kwargs)


# -------------------------------------------------------------------
# Messaging
# -------------------------------------------------------------------
class MessageThread(models.Model):
    """
    Direct message thread between two users.

    - `project` is optional, used only as "origin project"
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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    owner_ignored_until = models.DateTimeField(null=True, blank=True)
    client_ignored_until = models.DateTimeField(null=True, blank=True)

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

        if created and origin_project and not thread.project:
            thread.project = origin_project

        if initiated_by is not None and created:
            if initiated_by == owner:
                thread.owner_has_accepted = True
                thread.client_has_accepted = False
            elif initiated_by == client:
                thread.client_has_accepted = True
                thread.owner_has_accepted = False

        thread.save()
        return thread, created

    def user_is_participant(self, user):
        # ✅ FIX: no undefined helper
        return user and user.id in (self.owner_id, self.client_id)

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
        if uid == self.owner_id and not self.owner_has_accepted:
            self.owner_has_accepted = True
            self.save(update_fields=["owner_has_accepted"])
        elif uid == self.client_id and not self.client_has_accepted:
            self.client_has_accepted = True
            self.save(update_fields=["client_has_accepted"])

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

    @property
    def latest_message(self):
        return self.messages.order_by("-created_at").first()

    def unread_count_for(self, user):
        return 0


def message_attachment_upload_path(instance, filename):
    thread = instance.thread
    # thread.project can be null for "direct" messages (no project context)
    project_part = thread.project_id or "direct"
    return f"messages/{thread.owner_id}/{project_part}/{thread.client_id}/{filename}"

def ignored_until_for(self, user):
    """Return ignore-until datetime for this user (participant) or None."""
    if user.id == self.owner_id:
        return self.owner_ignored_until
    if user.id == self.client_id:
        return self.client_ignored_until
    return None

def set_ignored_until(self, user, until_dt):
    """Set ignore-until for the given user (participant)."""
    if user.id == self.owner_id:
        self.owner_ignored_until = until_dt
        self.save(update_fields=["owner_ignored_until"])
        return
    if user.id == self.client_id:
        self.client_ignored_until = until_dt
        self.save(update_fields=["client_ignored_until"])
        return

def mark_accepted(self, user):
    uid = user.id
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
        self.save(update_fields=[
            "owner_has_accepted", "client_has_accepted",
            "owner_ignored_until", "client_ignored_until"
        ])

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

    attachment = models.FileField(
        upload_to=message_attachment_upload_path,
        blank=True,
        null=True,
    )
    attachment_name = models.CharField(max_length=255, blank=True, default="")
    attachment_type = models.CharField(max_length=50, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Message<{self.id}> in thread {self.thread_id}"
# backend/portfolio/models.py
from io import BytesIO
import os
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import models
from PIL import Image

from .utils import convert_field_file_to_webp

User = get_user_model()


def direct_message_upload_path(instance, filename):
    """
    Used by older migrations for PrivateMessage attachments.
    Keep it simple & stable so existing migrations & files still work.
    """
    # If you later want something fancier, you can tweak this,
    # but keep the name and signature.
    return os.path.join("direct_messages", filename)
    

def project_cover_upload_path(instance, filename):
    return f"projects/{instance.owner_id}/{instance.id or 'new'}/cover/{filename}"


def project_image_upload_path(instance, filename):
    # instance is ProjectImage
    return f"projects/{instance.project.owner_id}/{instance.project_id}/images/{filename}"


class Project(models.Model):
    cover_image = models.ImageField(upload_to="project_covers/", blank=True, null=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects")

    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    category = models.CharField(max_length=100, blank=True)

    cover_image = models.ImageField(upload_to="projects/covers/", blank=True, null=True)

    is_public = models.BooleanField(default=True)
    tech_stack = models.JSONField(blank=True, null=True)

    # New optional fields expected by the frontend
    location = models.CharField(max_length=140, blank=True, default="")
    budget = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    sqf = models.IntegerField(blank=True, null=True)
    highlights = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Optional: link to a material/tool used for this project
    material_url = models.URLField(blank=True, null=True)
    material_label = models.CharField(
        max_length=255,
        blank=True,
        help_text="Short title/description for the material/tool (e.g. 'DeWalt Drill – $129').",
        null=True,
    )

    def save(self, *args, **kwargs):
        if self.cover_image and hasattr(self.cover_image, "file"):
            convert_field_file_to_webp(self.cover_image, quality=80)
        super().save(*args, **kwargs)
    pass

class ProjectFavorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_favorites",  # avoid clashes
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
        """
        Convert self.image file to WebP and replace the field's file.
        Only runs if current file is NOT already .webp.
        """
        if not self.image:
            return

        # Current file name + extension
        current_name = self.image.name
        root, ext = os.path.splitext(current_name.lower())


        # Already webp? nothing to do
        if ext == ".webp":
            return

        # Open the image via Pillow
        img = Image.open(self.image)

        # Ensure a safe mode for WEBP
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        # Save to in-memory buffer as WEBP
        buffer = BytesIO()
        # Tune quality as you like (60–85 is common)
        img.save(buffer, format="WEBP", quality=80)
        buffer.seek(0)

        new_name = f"{root}.webp"
        old_name = current_name

        # Replace file on the field (but don't commit to DB yet)
        self.image.save(new_name, ContentFile(buffer.read()), save=False)

        # Remove old file from storage if different
        if old_name and old_name != self.image.name and default_storage.exists(old_name):
            try:
                default_storage.delete(old_name)
            except Exception:
                # Silent fail – you can log this if you want
                pass

    def save(self, *args, **kwargs):
        # If there is a new file, convert it before actual save
        if self.image and hasattr(self.image, "file"):
            self._convert_image_to_webp()

        super().save(*args, **kwargs)


class MessageThread(models.Model):
    """
    Direct message thread between two users.
    We reuse the existing `owner` and `client` fields as the two participants
    (user A and user B). We no longer treat this as project-specific.

    - Exactly one thread per user pair (owner, client) with ordered IDs.
    - `project` is now optional and only used to remember origin of first contact.
    - `*_has_accepted` implements message requests.
    - `*_blocked_*` implements blocking.
    """

    # OPTIONAL: keep project as "origin" (who you first contacted about)
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

    # Per-user accept / archive / block flags
    owner_has_accepted = models.BooleanField(default=True)
    client_has_accepted = models.BooleanField(default=False)

    owner_archived = models.BooleanField(default=False)
    client_archived = models.BooleanField(default=False)

    owner_blocked_client = models.BooleanField(default=False)
    client_blocked_owner = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            # one thread per user pair (owner, client) – we enforce ordering in code
            models.UniqueConstraint(
                fields=["owner", "client"],
                name="unique_dm_pair",
            )
        ]

    def __str__(self):
        return f"DM<{self.id}> users={self.owner_id},{self.client_id}"

    # ---- helper methods ----
    @classmethod
    def normalize_users(cls, u1, u2):
        """Return (owner, client) ordered by id so uniqueness works."""
        if u1.id < u2.id:
            return u1, u2
        return u2, u1

    @classmethod
    def get_or_create_dm(cls, u1, u2, *, origin_project=None, initiated_by=None):
        """
        Get or create a DM thread between two distinct users.
        `initiated_by` is the sender of the first/new message.
        """
        if u1 == u2:
            raise ValueError("Cannot create a DM thread with yourself.")

        owner, client = cls.normalize_users(u1, u2)
        thread, created = cls.objects.get_or_create(owner=owner, client=client)

        # Set origin project only the first time
        if created and origin_project and not thread.project:
            thread.project = origin_project

        # First contact / new sender side: mark acceptance for the sender.
        if initiated_by is not None:
            if initiated_by == owner:
                if created:
                    thread.owner_has_accepted = True
                    thread.client_has_accepted = False
            elif initiated_by == client:
                if created:
                    thread.client_has_accepted = True
                    thread.owner_has_accepted = False

        thread.save()
        return thread, created

    def user_is_participant(self, user):
        return user_id(user) in (self.owner_id, self.client_id)

    def is_blocked_for(self, user):
        """True if this user has blocked the other or is blocked by the other."""
        uid = user.id
        if uid == self.owner_id:
            return self.owner_blocked_client or self.client_blocked_owner
        if uid == self.client_id:
            return self.client_blocked_owner or self.owner_blocked_client
        return True  # non-participant: treat as blocked

    def user_has_accepted(self, user):
        uid = user.id
        if uid == self.owner_id:
            return self.owner_has_accepted
        if uid == self.client_id:
            return self.client_has_accepted
        return False

    def mark_accepted(self, user):
        uid = user.id
        changed = False
        if uid == self.owner_id and not self.owner_has_accepted:
            self.owner_has_accepted = True
            changed = True
        elif uid == self.client_id and not self.client_has_accepted:
            self.client_has_accepted = True
            changed = True
        if changed:
            self.save(update_fields=["owner_has_accepted", "client_has_accepted"])

    def block_other(self, user):
        uid = user.id
        if uid == self.owner_id:
            if not self.owner_blocked_client:
                self.owner_blocked_client = True
                self.save(update_fields=["owner_blocked_client"])
        elif uid == self.client_id:
            if not self.client_blocked_owner:
                self.client_blocked_owner = True
                self.save(update_fields=["client_blocked_owner"])

    def unblock_other(self, user):
        uid = user.id
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
        """You can later add a MessageRead model; for now, return 0 or stub."""
        return 0  # placeholder, or compute from a read-tracking model



def message_attachment_upload_path(instance, filename):
    thread = instance.thread
    return f"messages/{thread.owner_id}/{thread.project_id}/{thread.client_id}/{filename}"


class PrivateMessage(models.Model):
    thread = models.ForeignKey(
        MessageThread, related_name="messages", on_delete=models.CASCADE
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="sent_messages", on_delete=models.CASCADE
    )
    text = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to=message_attachment_upload_path, blank=True, null=True
    )
    attachment_name = models.CharField(max_length=255, blank=True, default="")
    attachment_type = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Message<{self.id}> in thread {self.thread_id}"
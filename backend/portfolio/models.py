# backend/portfolio/models.py
from io import BytesIO
import os

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
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")

    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    category = models.CharField(max_length=120, blank=True)

    cover_image = models.ImageField(upload_to=project_cover_upload_path, blank=True, null=True)

    is_public = models.BooleanField(default=True)
    tech_stack = models.JSONField(blank=True, null=True)

    # New optional fields expected by the frontend
    location = models.CharField(max_length=140, blank=True, default="")
    budget = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    sqf = models.IntegerField(blank=True, null=True)
    highlights = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.cover_image and hasattr(self.cover_image, "file"):
            convert_field_file_to_webp(self.cover_image, quality=80)
        super().save(*args, **kwargs)


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
    project = models.ForeignKey(
        Project, related_name="message_threads", on_delete=models.CASCADE
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "client"],
                name="unique_project_client_thread",
            )
        ]

    def __str__(self):
        return f"Thread project={self.project_id} client={self.client_id}"


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
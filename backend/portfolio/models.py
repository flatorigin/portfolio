# backend/portfolio/models.py
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

def project_cover_upload_path(instance, filename):
    return f"projects/{instance.owner_id}/{instance.id or 'new'}/cover/{filename}"

def project_image_upload_path(instance, filename):
    # instance is ProjectImage
    return f"projects/{instance.project.owner_id}/{instance.project_id}/images/{filename}"

class Project(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")

    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    category = models.CharField(max_length=120, blank=True)

    cover_image = models.ImageField(upload_to=project_cover_upload_path, blank=True, null=True)

    is_public = models.BooleanField(default=True)
    tech_stack = models.JSONField(blank=True, null=True)

    # ✅ New optional fields expected by the frontend
    location = models.CharField(max_length=140, blank=True, default="")
    budget = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    sqf = models.IntegerField(blank=True, null=True)
    highlights = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Project<{self.id}:{self.title}>"

class ProjectImage(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to=project_image_upload_path)
    caption = models.CharField(max_length=240, blank=True, default="")
    alt_text = models.CharField(max_length=200, blank=True, default="")
    extra_data = models.JSONField(blank=True, null=True)
    order = models.PositiveIntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"ProjectImage<{self.id} p{self.project_id}>"

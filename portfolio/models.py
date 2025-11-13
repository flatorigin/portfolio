from django.db import models
from django.contrib.auth.models import User

class Project(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    category = models.CharField(max_length=120, blank=True)
    cover_image = models.ImageField(upload_to="projects/covers/", blank=True, null=True)
    is_public = models.BooleanField(default=True)
    tech_stack = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self):
        return self.title

class ProjectImage(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="images")
    image = models.ImageField(upload_to="projects/images/")
    caption = models.CharField(max_length=240, blank=True)
    alt_text = models.CharField(max_length=200, blank=True)
    extra_data = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return f"{self.project.title} #{self.order}"

# backend/portfolio/signals.py
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import ProjectImage


@receiver(post_delete, sender=ProjectImage)
def delete_project_image_file(sender, instance, **kwargs):
    if instance.image:
        try:
            instance.image.delete(save=False)
        except Exception:
            # don't crash deletes if storage is temporarily unavailable
            pass
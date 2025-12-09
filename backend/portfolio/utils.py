# backend/portfolio/utils.py
from io import BytesIO
import os
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image
from rest_framework.routers import DefaultRouter

def convert_field_file_to_webp(field_file, quality=80):
    if not field_file:
        return

    router = DefaultRouter()
    router.register(r"projects", ProjectViewSet, basename="project")

    urlpatterns = [
        # ...
        path("api/", include(router.urls)),
    ]

    current_name = field_file.name
    root, ext = os.path.splitext(current_name.lower())
    if ext == ".webp":
        return

    img = Image.open(field_file)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    buffer = BytesIO()
    img.save(buffer, format="WEBP", quality=quality)
    buffer.seek(0)

    new_name = f"{root}.webp"
    old_name = current_name
    field_file.save(new_name, ContentFile(buffer.read()), save=False)

    if old_name and old_name != field_file.name and default_storage.exists(old_name):
        try:
            default_storage.delete(old_name)
        except Exception:
            pass

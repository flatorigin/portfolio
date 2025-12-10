# backend/portfolio/utils.py
from io import BytesIO
import os

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image


def convert_field_file_to_webp(*args, **kwargs):
    """
    Convert an ImageField/FileField on a model instance to WEBP.

    This is intentionally defensive so it won't crash the app even if called as:
      - convert_field_file_to_webp(instance)
      - convert_field_file_to_webp(instance, "image")
      - convert_field_file_to_webp(instance, field_name="image")

    If we can't determine a field_name safely, we just return without doing anything.
    """

    # --- Extract instance and field_name safely ---
    if not args:
        # No instance passed at all → nothing to do
        return

    instance = args[0]

    # Try to get field_name from positional args or kwargs
    field_name = None
    if len(args) >= 2:
        field_name = args[1]
    else:
        field_name = kwargs.get("field_name")

    # If no field_name was provided, we *do not* error out:
    # just no-op to keep old call sites from crashing.
    if not field_name:
        return

    # --- Now do the actual WEBP conversion ---
    field_file = getattr(instance, field_name, None)
    if not field_file:
        return

    current_name = getattr(field_file, "name", None)
    if not current_name:
        return

    root, ext = os.path.splitext(current_name.lower())
    if ext == ".webp":
        # Already WEBP
        return

    try:
        img = Image.open(field_file)

        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        buffer = BytesIO()
        img.save(buffer, format="WEBP", quality=80)
        buffer.seek(0)

        new_name = f"{root}.webp"
        old_name = current_name

        field_file.save(new_name, ContentFile(buffer.read()), save=False)

        if (
            old_name
            and old_name != field_file.name
            and default_storage.exists(old_name)
        ):
            try:
                default_storage.delete(old_name)
            except Exception:
                # Don't break if delete fails
                pass

    except Exception:
        # Never let conversion break the request
        return

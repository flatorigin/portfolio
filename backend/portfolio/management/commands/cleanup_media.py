# backend/portfolio/management/commands/cleanup_media.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Set

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import QuerySet

# Adjust these imports to your actual models
from portfolio.models import ProjectImage  # <-- confirm model name
# If you have profile avatars/logos:
# from accounts.models import Profile


@dataclass(frozen=True)
class CleanupStats:
    total_files: int
    referenced_files: int
    deleted_files: int
    skipped_dirs: int


def _normalize_rel_path(p: str) -> str:
    p = (p or "").strip()
    if not p:
        return ""
    # Django ImageField usually stores "project_images/file.webp"
    return p.lstrip("/")


def _get_referenced_paths() -> Set[str]:
    referenced: Set[str] = set()

    qs: QuerySet = ProjectImage.objects.all().only("image")
    for obj in qs.iterator():
        rel = _normalize_rel_path(getattr(obj, "image", ""))
        if rel:
            referenced.add(rel)

    # Add other references here if you have them:
    # for prof in Profile.objects.all().only("logo"):
    #     rel = _normalize_rel_path(getattr(prof, "logo", ""))
    #     if rel:
    #         referenced.add(rel)

    return referenced


def _iter_files(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if p.is_file():
            yield p


class Command(BaseCommand):
    help = "Delete unreferenced media files from MEDIA_ROOT safely (dry-run supported)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only print what would be deleted.")
        parser.add_argument(
            "--subdir",
            default="project_images",
            help="Subdirectory under MEDIA_ROOT to clean (default: project_images).",
        )

    def handle(self, *args, **opts):
        dry_run: bool = opts["dry_run"]
        subdir: str = opts["subdir"]

        media_root = Path(settings.MEDIA_ROOT).resolve()
        target_root = (media_root / subdir).resolve()

        self.stdout.write(f"MEDIA_ROOT={media_root}")
        self.stdout.write(f"Target={target_root}")
        if not target_root.exists():
            self.stdout.write(self.style.WARNING("Target directory does not exist; nothing to do."))
            return

        referenced = _get_referenced_paths()
        referenced_in_target = {p for p in referenced if p.startswith(f"{subdir}/")}

        total_files = 0
        deleted_files = 0
        skipped_dirs = 0

        for f in _iter_files(target_root):
            total_files += 1
            rel = f.relative_to(media_root).as_posix()  # e.g. "project_images/deck_2.webp"

            if rel in referenced:
                continue

            if dry_run:
                self.stdout.write(f"DRY-RUN delete: {rel}")
            else:
                try:
                    f.unlink()
                    deleted_files += 1
                    self.stdout.write(self.style.SUCCESS(f"Deleted: {rel}"))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Failed to delete {rel}: {e}"))

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. total_files={total_files}, referenced={len(referenced_in_target)}, deleted={deleted_files}"
            )
        )
from html import escape
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from django.views import View

from .models import Project, ProjectImage


def _public_project(project):
    if not project or not project.is_public or project.is_private or project.post_privacy == "private":
        return False
    profile = getattr(project.owner, "profile", None)
    return not profile or (not profile.is_frozen and not profile.is_deactivated)


def _cover_url(project, request):
    cover = next(
        (
            image
            for image in sorted(project.images.all(), key=lambda item: (item.order, item.id))
            if image.media_type == ProjectImage.MEDIA_TYPE_IMAGE and image.image
        ),
        None,
    )
    if cover and hasattr(cover.image, "url"):
        return request.build_absolute_uri(cover.image.url)
    if project.cover_image_file and hasattr(project.cover_image_file, "url"):
        return request.build_absolute_uri(project.cover_image_file.url)
    return ""


class PublicProjectPageView(View):
    def get(self, request, pk):
        index_path = Path(settings.FRONTEND_DIR) / "index.html"
        html = index_path.read_text(encoding="utf-8")
        project = (
            Project.objects.select_related("owner__profile")
            .prefetch_related("images")
            .filter(pk=pk)
            .first()
        )

        if not _public_project(project):
            return HttpResponse(html, content_type="text/html; charset=utf-8")

        title = str(project.title or "FlatOrigin project").strip()
        raw_description = str(project.job_summary or project.summary or project.category or "").strip()
        description = " ".join(raw_description.split())[:240] or "View this project on FlatOrigin."
        project_url = request.build_absolute_uri(f"/projects/{project.id}")
        image_url = _cover_url(project, request)
        page_title = f"{title} | FlatOrigin"

        tags = [
            f'<meta name="description" content="{escape(description, quote=True)}" />',
            f'<link rel="canonical" href="{escape(project_url, quote=True)}" />',
            '<meta property="og:type" content="article" />',
            '<meta property="og:site_name" content="FlatOrigin" />',
            f'<meta property="og:title" content="{escape(title, quote=True)}" />',
            f'<meta property="og:description" content="{escape(description, quote=True)}" />',
            f'<meta property="og:url" content="{escape(project_url, quote=True)}" />',
            '<meta name="twitter:card" content="summary_large_image" />',
            f'<meta name="twitter:title" content="{escape(title, quote=True)}" />',
            f'<meta name="twitter:description" content="{escape(description, quote=True)}" />',
        ]
        if image_url:
            tags.extend(
                [
                    f'<meta property="og:image" content="{escape(image_url, quote=True)}" />',
                    f'<meta name="twitter:image" content="{escape(image_url, quote=True)}" />',
                ]
            )

        meta_tags = "\n    ".join(tags)
        html = html.replace("<title>FlatOrigin</title>", f"<title>{escape(page_title)}</title>", 1)
        html = html.replace("</title>", f"</title>\n    {meta_tags}", 1)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

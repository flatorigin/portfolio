from html import escape
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from django.views import View

from accounts.models import BusinessDirectoryListing

from .models import HelperListing, Project


def _public_project(project):
    if not project or not project.is_public or project.is_private or project.post_privacy == "private":
        return False
    profile = getattr(project.owner, "profile", None)
    return not profile or (not profile.is_frozen and not profile.is_deactivated)


def _cover_url(project, request):
    cover = project.get_cover_image()
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


class PublicHelperPageView(View):
    def get(self, request, pk):
        index_path = Path(settings.FRONTEND_DIR) / "index.html"
        html = index_path.read_text(encoding="utf-8")
        helper = HelperListing.objects.filter(
            pk=pk,
            is_active=True,
            admin_approved=True,
            contact_verified=True,
        ).first()

        if not helper:
            return HttpResponse(html, content_type="text/html; charset=utf-8")

        name = str(helper.full_name or "Project helper").strip()
        location = ", ".join(item for item in (helper.city, helper.state) if item)
        skills = ", ".join(helper.skill_labels()[:5])
        details = [f"Skills: {skills}" if skills else "", f"Serving {location}" if location else "", helper.bio]
        description = " ".join(" ".join(str(item).split()) for item in details if item)[:240]
        description = description or f"View {name}'s project helper card on FlatOrigin."
        helper_url = request.build_absolute_uri(f"/project-helpers/{helper.id}")
        title = f"{name} — Project Helper"

        tags = [
            f'<meta name="description" content="{escape(description, quote=True)}" />',
            f'<link rel="canonical" href="{escape(helper_url, quote=True)}" />',
            '<meta property="og:type" content="profile" />',
            '<meta property="og:site_name" content="FlatOrigin" />',
            f'<meta property="og:title" content="{escape(title, quote=True)}" />',
            f'<meta property="og:description" content="{escape(description, quote=True)}" />',
            f'<meta property="og:url" content="{escape(helper_url, quote=True)}" />',
            '<meta name="twitter:card" content="summary" />',
            f'<meta name="twitter:title" content="{escape(title, quote=True)}" />',
            f'<meta name="twitter:description" content="{escape(description, quote=True)}" />',
        ]
        meta_tags = "\n    ".join(tags)
        page_title = f"{title} | FlatOrigin"
        html = html.replace("<title>FlatOrigin</title>", f"<title>{escape(page_title)}</title>", 1)
        html = html.replace("</title>", f"</title>\n    {meta_tags}", 1)
        return HttpResponse(html, content_type="text/html; charset=utf-8")


class PublicBusinessDirectoryPageView(View):
    def get(self, request, pk):
        index_path = Path(settings.FRONTEND_DIR) / "index.html"
        html = index_path.read_text(encoding="utf-8")
        listing = BusinessDirectoryListing.objects.filter(
            pk=pk,
            is_published=True,
            is_removed=False,
        ).first()

        if not listing:
            return HttpResponse(html, content_type="text/html; charset=utf-8")

        name = str(listing.business_name or "Local business").strip()
        location = str(listing.location or "").strip()
        specialties = ", ".join(str(item).strip() for item in listing.specialties[:5] if str(item).strip())
        details = [specialties and f"Services: {specialties}", location and f"Serving {location}"]
        description = ". ".join(item for item in details if item)[:240]
        description = description or f"View {name} in the FlatOrigin contractor directory."
        listing_url = request.build_absolute_uri(f"/business-directory/{listing.id}")

        tags = [
            f'<meta name="description" content="{escape(description, quote=True)}" />',
            f'<link rel="canonical" href="{escape(listing_url, quote=True)}" />',
            '<meta property="og:type" content="profile" />',
            '<meta property="og:site_name" content="FlatOrigin" />',
            f'<meta property="og:title" content="{escape(name, quote=True)}" />',
            f'<meta property="og:description" content="{escape(description, quote=True)}" />',
            f'<meta property="og:url" content="{escape(listing_url, quote=True)}" />',
            '<meta name="twitter:card" content="summary" />',
            f'<meta name="twitter:title" content="{escape(name, quote=True)}" />',
            f'<meta name="twitter:description" content="{escape(description, quote=True)}" />',
        ]
        meta_tags = "\n    ".join(tags)
        page_title = f"{name} | FlatOrigin"
        html = html.replace("<title>FlatOrigin</title>", f"<title>{escape(page_title)}</title>", 1)
        html = html.replace("</title>", f"</title>\n    {meta_tags}", 1)
        return HttpResponse(html, content_type="text/html; charset=utf-8")

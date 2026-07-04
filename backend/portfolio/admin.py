from django.contrib import admin
from django.utils.html import format_html, format_html_join

from .models import Project, ProjectImage, FeedbackTicket, FeedbackAttachment

class ProjectImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 0

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("title","owner","is_public","created_at")
    inlines = [ProjectImageInline]

@admin.register(ProjectImage)
class ProjectImageAdmin(admin.ModelAdmin):
    list_display = ("project", "media_type", "processing_status", "order", "created_at")


class FeedbackAttachmentInline(admin.TabularInline):
    model = FeedbackAttachment
    extra = 0
    fields = ("original_name", "content_type", "size", "uploaded_at", "download_link")
    readonly_fields = ("original_name", "content_type", "size", "uploaded_at", "download_link")
    can_delete = False

    def download_link(self, obj):
        if not obj or not obj.file:
            return "-"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Download</a>',
            obj.file.url,
        )

    download_link.short_description = "File"


@admin.register(FeedbackTicket)
class FeedbackTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "category", "subject", "status", "created_at", "updated_at")
    list_filter = ("category", "status", "created_at", "updated_at")
    search_fields = ("subject", "message", "user__username", "user__email")
    readonly_fields = ("user", "category", "subject", "message", "safe_links", "created_at", "updated_at", "resolved_notified_at")
    fields = (
        "user",
        "category",
        "subject",
        "message",
        "safe_links",
        "status",
        "internal_admin_note",
        "resolved_notified_at",
        "created_at",
        "updated_at",
    )
    inlines = [FeedbackAttachmentInline]

    def safe_links(self, obj):
        links = obj.links if isinstance(obj.links, list) else []
        if not links:
            return "-"
        return format_html_join(
            "",
            '<div><a href="{}" target="_blank" rel="noopener noreferrer">{}</a></div>',
            ((link, link) for link in links),
        )

    safe_links.short_description = "Links"


@admin.register(FeedbackAttachment)
class FeedbackAttachmentAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "original_name", "content_type", "size", "uploaded_at", "download_link")
    list_filter = ("content_type", "uploaded_at")
    search_fields = ("original_name", "ticket__subject", "ticket__user__username", "ticket__user__email")
    readonly_fields = ("ticket", "original_name", "content_type", "size", "uploaded_at", "download_link")

    def download_link(self, obj):
        if not obj or not obj.file:
            return "-"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">Download</a>',
            obj.file.url,
        )

    download_link.short_description = "File"

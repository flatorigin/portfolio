from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from .models import (
    Project,
    ProjectImage,
    FeedbackTicket,
    FeedbackAttachment,
    FeedbackReply,
    HelperListing,
    HelperFeedback,
)

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


class HelperSkillListFilter(admin.SimpleListFilter):
    title = "skill"
    parameter_name = "skill"

    def lookups(self, request, model_admin):
        return HelperListing.SKILL_CHOICES

    def queryset(self, request, queryset):
        value = self.value()
        if not value:
            return queryset
        return queryset.filter(skills__icontains=value)


class HelperFeedbackInline(admin.TabularInline):
    model = HelperFeedback
    extra = 0
    fields = (
        "reviewer",
        "project_type",
        "worked_together",
        "reliability_rating",
        "communication_rating",
        "work_quality_rating",
        "would_hire_again",
        "short_note",
        "is_approved",
        "created_at",
    )
    readonly_fields = ("reviewer", "created_at")


@admin.register(HelperListing)
class HelperListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "city",
        "state",
        "experience_level",
        "is_active",
        "admin_approved",
        "contact_verified",
        "created_at",
        "updated_at",
    )
    list_filter = (
        "is_active",
        "admin_approved",
        "contact_verified",
        "city",
        HelperSkillListFilter,
        "experience_level",
    )
    search_fields = (
        "full_name",
        "city",
        "email",
        "phone",
        "skills",
        "bio",
    )
    readonly_fields = (
        "owner",
        "verification_token",
        "verification_sent_at",
        "contact_verified_at",
        "created_at",
        "updated_at",
    )
    fields = (
        "owner",
        "full_name",
        "city",
        "state",
        "service_radius_miles",
        "phone",
        "email",
        "preferred_contact_method",
        "skills",
        "other_skill",
        "availability",
        "experience_level",
        "bio",
        "is_active",
        "admin_approved",
        "contact_verified",
        "contact_verified_at",
        "verification_token",
        "verification_sent_at",
        "created_at",
        "updated_at",
    )
    inlines = [HelperFeedbackInline]
    actions = ("approve_listings", "deactivate_listings", "mark_contact_verified")

    def approve_listings(self, request, queryset):
        queryset.update(
            admin_approved=True,
            is_active=True,
            contact_verified=True,
            contact_verified_at=timezone.now(),
        )

    approve_listings.short_description = "Approve and publish selected helper listings"

    def deactivate_listings(self, request, queryset):
        queryset.update(is_active=False)

    deactivate_listings.short_description = "Deactivate selected helper listings"

    def mark_contact_verified(self, request, queryset):
        queryset.update(contact_verified=True, contact_verified_at=timezone.now())

    mark_contact_verified.short_description = "Mark selected contacts verified"


@admin.register(HelperFeedback)
class HelperFeedbackAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "helper",
        "reviewer",
        "project_type",
        "worked_together",
        "would_hire_again",
        "is_approved",
        "created_at",
    )
    list_filter = (
        "is_approved",
        "worked_together",
        "would_hire_again",
        "reliability_rating",
        "communication_rating",
        "work_quality_rating",
        "created_at",
    )
    search_fields = (
        "helper__full_name",
        "helper__city",
        "reviewer__username",
        "reviewer__email",
        "project_type",
        "short_note",
    )
    readonly_fields = ("helper", "reviewer", "created_at")
    actions = ("approve_feedback", "remove_feedback")

    def approve_feedback(self, request, queryset):
        queryset.update(is_approved=True)

    approve_feedback.short_description = "Approve selected feedback"

    def remove_feedback(self, request, queryset):
        queryset.update(is_approved=False)

    remove_feedback.short_description = "Unapprove selected feedback"


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


class FeedbackReplyInline(admin.StackedInline):
    model = FeedbackReply
    extra = 0
    fields = ("author", "is_staff_reply", "message", "created_at", "notified_at")
    readonly_fields = ("created_at", "notified_at")


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
    inlines = [FeedbackAttachmentInline, FeedbackReplyInline]

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)
        for instance in instances:
            if isinstance(instance, FeedbackReply) and instance.pk is None:
                if instance.author_id is None:
                    instance.author = request.user
                instance.is_staff_reply = True
                instance.save()
                instance.send_created_notification()
            else:
                instance.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()

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
    list_display = ("id", "ticket", "reply", "original_name", "content_type", "size", "uploaded_at", "download_link")
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


@admin.register(FeedbackReply)
class FeedbackReplyAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "author", "is_staff_reply", "created_at", "notified_at")
    list_filter = ("is_staff_reply", "created_at", "notified_at")
    search_fields = ("message", "ticket__subject", "author__username", "author__email")
    readonly_fields = ("created_at", "notified_at")

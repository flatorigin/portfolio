from django import forms
from django.contrib import admin, messages
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from accounts.models import user_can_access_admin

from .models import (
    Project,
    ProjectImage,
    FeedbackTicket,
    FeedbackAttachment,
    FeedbackReply,
    HelperListing,
    HelperFeedback,
)


def user_can_moderate_project_images(user):
    if not user_can_access_admin(user):
        return False
    if user.is_superuser:
        return True
    access = getattr(user, "staff_access", None)
    return bool(access and access.can_manage_moderation)


class ProjectModerationAdminMixin:
    def has_module_permission(self, request):
        return user_can_moderate_project_images(request.user)

    def has_view_permission(self, request, obj=None):
        return user_can_moderate_project_images(request.user)

    def has_change_permission(self, request, obj=None):
        return user_can_moderate_project_images(request.user)

    def has_add_permission(self, request):
        return bool(request.user.is_superuser)


def project_image_preview(image, size=72):
    if not image:
        return "-"
    file_field = image.thumbnail if image.thumbnail else image.image
    if not file_field or not hasattr(file_field, "url"):
        return "-"
    return format_html(
        '<a href="{}" target="_blank" rel="noopener">'
        '<img src="{}" alt="" style="width:{}px;height:{}px;object-fit:cover;border-radius:4px;" />'
        "</a>",
        file_field.url,
        file_field.url,
        size,
        size,
    )


class ProjectAdminForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        cover_field = self.fields.get("cover_image_ref")
        if not cover_field:
            return
        cover_field.label = "Cover image"
        cover_field.help_text = "Choose one of this project's images for cards and shared-link previews."
        if self.instance and self.instance.pk:
            cover_field.queryset = self.instance.images.filter(
                media_type=ProjectImage.MEDIA_TYPE_IMAGE
            ).order_by("order", "id")
        else:
            cover_field.queryset = ProjectImage.objects.none()

    def clean_cover_image_ref(self):
        cover = self.cleaned_data.get("cover_image_ref")
        if cover and self.instance.pk and cover.project_id != self.instance.pk:
            raise forms.ValidationError("Choose an image that belongs to this project.")
        return cover


class ProjectImageInline(admin.TabularInline):
    model = ProjectImage
    extra = 0
    can_delete = True
    show_change_link = True
    verbose_name_plural = "User-uploaded images - select Delete? and save to remove images"
    fields = (
        "image_preview",
        "caption",
        "order",
        "media_type",
        "processing_status",
    )
    readonly_fields = ("image_preview", "media_type", "processing_status")

    def has_view_permission(self, request, obj=None):
        return user_can_moderate_project_images(request.user)

    def has_change_permission(self, request, obj=None):
        return user_can_moderate_project_images(request.user)

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return user_can_moderate_project_images(request.user)

    @admin.display(description="Preview")
    def image_preview(self, obj):
        return project_image_preview(obj)

@admin.register(Project)
class ProjectAdmin(ProjectModerationAdminMixin, admin.ModelAdmin):
    form = ProjectAdminForm
    list_display = (
        "title",
        "owner",
        "cover_preview",
        "is_job_posting",
        "is_public",
        "created_at",
    )
    list_filter = ("is_job_posting", "is_public", "is_private", "post_privacy")
    search_fields = ("title", "owner__username", "owner__email")
    list_select_related = ("owner", "cover_image_ref")
    inlines = [ProjectImageInline]

    @admin.display(description="Cover")
    def cover_preview(self, obj):
        return project_image_preview(obj.get_cover_image(), size=56)

@admin.register(ProjectImage)
class ProjectImageAdmin(ProjectModerationAdminMixin, admin.ModelAdmin):
    list_display = (
        "image_preview",
        "project",
        "is_project_cover",
        "media_type",
        "processing_status",
        "order",
        "created_at",
    )
    list_filter = ("media_type", "processing_status")
    search_fields = ("project__title", "project__owner__username", "caption", "alt_text")
    list_select_related = ("project", "project__cover_image_ref")
    actions = ("set_as_project_cover",)

    def has_delete_permission(self, request, obj=None):
        return user_can_moderate_project_images(request.user)

    @admin.display(description="Preview")
    def image_preview(self, obj):
        return project_image_preview(obj)

    @admin.display(boolean=True, description="Cover")
    def is_project_cover(self, obj):
        return obj.project.get_cover_image() == obj

    @admin.action(description="Set selected image as its project cover")
    def set_as_project_cover(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Select exactly one image.", level=messages.ERROR)
            return

        cover = queryset.select_related("project").first()
        if cover.media_type != ProjectImage.MEDIA_TYPE_IMAGE:
            self.message_user(request, "Only an image can be used as a project cover.", level=messages.ERROR)
            return

        with transaction.atomic():
            ProjectImage.objects.filter(project=cover.project).exclude(pk=cover.pk).update(
                order=F("order") + 1
            )
            cover.order = 0
            cover.save(update_fields=["order"])
            cover.project.cover_image_ref = cover
            cover.project.save(update_fields=["cover_image_ref"])

        self.message_user(
            request,
            f'"{cover}" is now the cover for "{cover.project.title}".',
            level=messages.SUCCESS,
        )


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
        "reliability_rating",
        "communication_rating",
        "work_quality_rating",
        "worked_together",
        "would_hire_again",
        "is_approved",
        "created_at",
    )
    list_editable = ("is_approved",)
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

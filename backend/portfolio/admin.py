from django.contrib import admin, messages
from django.db import transaction
from django.http import HttpResponseRedirect
from django.urls import reverse
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


@admin.register(Project)
class ProjectAdmin(ProjectModerationAdminMixin, admin.ModelAdmin):
    change_form_template = "admin/portfolio/project/change_form.html"
    delete_confirmation_template = "admin/portfolio/project/delete_confirmation.html"
    exclude = ("cover_image_ref",)
    list_display = (
        "title",
        "owner",
        "cover_preview",
        "manage_images",
        "is_job_posting",
        "is_public",
        "created_at",
    )
    list_filter = ("is_job_posting", "is_public", "is_private", "post_privacy")
    search_fields = ("title", "owner__username", "owner__email")
    list_select_related = ("owner", "cover_image_ref")

    def has_delete_permission(self, request, obj=None):
        # Full project deletion is intentionally unavailable as a bulk action.
        return bool(obj and request.user.is_superuser)

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        obj = self.get_object(request, object_id) if object_id else None
        extra_context = {
            **(extra_context or {}),
            "show_delete": False,
            "can_delete_entire_project": self.has_delete_permission(request, obj),
        }
        return super().changeform_view(request, object_id, form_url, extra_context)

    def delete_view(self, request, object_id, extra_context=None):
        obj = self.get_object(request, object_id)
        if request.method == "POST" and obj:
            entered_title = request.POST.get("confirm_project_title", "").strip()
            if entered_title != obj.title:
                self.message_user(
                    request,
                    "Project title did not match. The project was not deleted.",
                    level=messages.ERROR,
                )
                delete_url = reverse("admin:portfolio_project_delete", args=[obj.pk])
                return HttpResponseRedirect(delete_url)

        extra_context = {
            **(extra_context or {}),
            "confirmation_project_title": obj.title if obj else "",
        }
        return super().delete_view(request, object_id, extra_context)

    @admin.display(description="Cover")
    def cover_preview(self, obj):
        return project_image_preview(obj.get_cover_image(), size=56)

    @admin.display(description="Images")
    def manage_images(self, obj):
        image_list_url = reverse("admin:portfolio_projectimage_changelist")
        return format_html(
            '<a class="button fo-manage-images" href="{}?project__id__exact={}">Manage images</a>',
            image_list_url,
            obj.pk,
        )

@admin.register(ProjectImage)
class ProjectImageAdmin(ProjectModerationAdminMixin, admin.ModelAdmin):
    change_list_template = "admin/portfolio/projectimage/change_list.html"
    delete_selected_confirmation_template = (
        "admin/portfolio/projectimage/delete_selected_confirmation.html"
    )
    list_display = (
        "image_preview",
        "project_title",
        "is_project_cover",
        "order",
    )
    list_display_links = ("project_title",)
    list_filter = ("project", "media_type", "processing_status")
    search_fields = ("project__title", "project__owner__username", "caption", "alt_text")
    list_select_related = ("project", "project__cover_image_ref")
    actions = ("set_as_project_cover",)

    def has_delete_permission(self, request, obj=None):
        return user_can_moderate_project_images(request.user)

    @admin.display(description="Preview")
    def image_preview(self, obj):
        return project_image_preview(obj, size=96)

    @admin.display(ordering="project__title", description="Project")
    def project_title(self, obj):
        return obj.project.title

    @admin.display(boolean=True, description="Cover")
    def is_project_cover(self, obj):
        return obj.project.get_cover_image() == obj

    def get_actions(self, request):
        actions = super().get_actions(request)
        if "delete_selected" in actions:
            delete_action, action_name, _ = actions["delete_selected"]
            actions["delete_selected"] = (
                delete_action,
                action_name,
                "Delete selected images",
            )
        return actions

    @admin.action(description="Make selected image the project cover")
    def set_as_project_cover(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Select exactly one image.", level=messages.ERROR)
            return

        cover = queryset.select_related("project").first()
        if cover.media_type != ProjectImage.MEDIA_TYPE_IMAGE:
            self.message_user(request, "Only an image can be used as a project cover.", level=messages.ERROR)
            return

        with transaction.atomic():
            project = Project.objects.select_for_update().get(pk=cover.project_id)
            images = list(
                ProjectImage.objects.select_for_update()
                .filter(project=project)
                .order_by("order", "id")
            )
            ordered_images = [cover] + [image for image in images if image.pk != cover.pk]
            for index, image in enumerate(ordered_images):
                image.order = index
            ProjectImage.objects.bulk_update(ordered_images, ["order"])

            project.cover_image_ref = cover
            project.save(update_fields=["cover_image_ref"])

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

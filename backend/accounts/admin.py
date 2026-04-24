# accounts/admin.py
from types import MethodType

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from .models import (
    AIConfiguration,
    AIUsageEvent,
    AdminAuditLog,
    DeletedEmailBlocklist,
    HomeownerReferenceImage,
    ModerationAction,
    Profile,
    StaffAccess,
    UserReport,
    user_can_access_admin,
)

User = get_user_model()


def log_admin_event(request, event_type, *, target_user=None, target_obj=None, summary="", metadata=None):
    content_type = None
    object_id = None
    if target_obj is not None:
        content_type = ContentType.objects.get_for_model(target_obj.__class__)
        object_id = target_obj.pk
    AdminAuditLog.objects.create(
        actor=getattr(request, "user", None) if getattr(request, "user", None) and request.user.is_authenticated else None,
        event_type=event_type,
        target_user=target_user,
        target_content_type=content_type,
        target_object_id=object_id,
        summary=summary,
        metadata=metadata or {},
    )


def _admin_site_has_permission(self, request):
    return user_can_access_admin(request.user)


admin.site.has_permission = MethodType(_admin_site_has_permission, admin.site)

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "email",
        "profile_type",
        "email_verified_at",
        "ai_daily_limit_override",
        "public_profile_enabled",
        "is_frozen",
        "is_deactivated",
        "frozen_at",
        "is_user_active",
    )
    list_editable = ("profile_type", "public_profile_enabled", "is_frozen", "is_deactivated")
    list_filter = ("profile_type", "public_profile_enabled", "is_frozen", "is_deactivated", "user__is_active")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("frozen_at", "deactivated_at")
    actions = (
        "make_contractors",
        "make_homeowners",
        "freeze_profiles",
        "unfreeze_profiles",
    )
    fieldsets = (
        ("Account settings", {
            "fields": (
                "user",
                "profile_type",
                "email_verified_at",
                "is_frozen",
                "frozen_at",
                "frozen_reason",
                "is_deactivated",
                "deactivated_at",
            )
        }),
        ("Identity", {
            "fields": (
                "display_name",
                "service_location",
                "coverage_radius_miles",
                "bio",
                "languages",
            )
        }),
        ("Contact visibility", {
            "fields": (
                "contact_email",
                "contact_phone",
                "show_contact_email",
                "show_contact_phone",
                "public_profile_enabled",
                "allow_direct_messages",
                "dm_opt_out_reason",
                "dm_opt_out_until",
            )
        }),
        ("AI quota", {
            "fields": ("ai_daily_limit_override",),
        }),
        ("Media and hero", {
            "fields": (
                "logo",
                "avatar",
                "banner",
                "hero_headline",
                "hero_blurb",
            )
        }),
    )

    @admin.display(ordering="user__email")
    def email(self, obj):
        return obj.user.email

    @admin.display(boolean=True, ordering="user__is_active")
    def is_user_active(self, obj):
        return obj.user.is_active

    @admin.action(description="Convert selected profiles to Contractor")
    def make_contractors(self, request, queryset):
        queryset.update(profile_type=Profile.ProfileType.CONTRACTOR)

    @admin.action(description="Convert selected profiles to Homeowner")
    def make_homeowners(self, request, queryset):
        queryset.update(profile_type=Profile.ProfileType.HOMEOWNER)

    @admin.action(description="Freeze selected profiles")
    def freeze_profiles(self, request, queryset):
        queryset.update(is_frozen=True, frozen_at=timezone.now())

    @admin.action(description="Unfreeze selected profiles")
    def unfreeze_profiles(self, request, queryset):
        queryset.update(is_frozen=False, frozen_at=None, frozen_reason="")

    def save_model(self, request, obj, form, change):
        if obj.is_frozen and not obj.frozen_at:
            obj.frozen_at = timezone.now()
        if not obj.is_frozen:
            obj.frozen_at = None
        super().save_model(request, obj, form, change)
        log_admin_event(
            request,
            AdminAuditLog.EventType.PROFILE_UPDATED,
            target_user=obj.user,
            target_obj=obj,
            summary=f"{'Updated' if change else 'Created'} profile for {obj.user.username}",
            metadata={
                "is_frozen": obj.is_frozen,
                "is_deactivated": obj.is_deactivated,
                "public_profile_enabled": obj.public_profile_enabled,
            },
        )


class StaffAccessInline(admin.StackedInline):
    model = StaffAccess
    fk_name = "user"
    can_delete = False
    extra = 0
    fields = (
        "role",
        "can_access_admin",
        "can_manage_accounts",
        "can_manage_moderation",
        "can_manage_verification",
        "can_manage_compliance",
        "require_password_reset",
        "last_reviewed_at",
        "reviewed_by",
        "notes",
    )
    readonly_fields = ("last_reviewed_at", "reviewed_by")


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    extra = 0
    fields = (
        "profile_type",
        "email_verified_at",
        "ai_daily_limit_override",
        "is_frozen",
        "frozen_at",
        "frozen_reason",
        "is_deactivated",
        "deactivated_at",
        "display_name",
        "service_location",
    )
    readonly_fields = ("frozen_at", "deactivated_at")


try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = (ProfileInline, StaffAccessInline)
    list_display = (
        "id",
        "username",
        "email",
        "profile_type",
        "profile_frozen",
        "profile_deactivated",
        "is_staff",
        "is_active",
    )
    list_filter = (
        "profile__profile_type",
        "profile__is_frozen",
        "profile__is_deactivated",
        "is_staff",
        "is_superuser",
        "is_active",
    )
    actions = (
        "freeze_accounts",
        "unfreeze_accounts",
        "make_contractors",
        "make_homeowners",
    )

    @admin.display(ordering="profile__profile_type")
    def profile_type(self, obj):
        return getattr(getattr(obj, "profile", None), "profile_type", "")

    @admin.display(boolean=True, ordering="profile__is_frozen")
    def profile_frozen(self, obj):
        return bool(getattr(getattr(obj, "profile", None), "is_frozen", False))

    @admin.display(boolean=True, ordering="profile__is_deactivated")
    def profile_deactivated(self, obj):
        return bool(getattr(getattr(obj, "profile", None), "is_deactivated", False))

    def _profiles_for_users(self, queryset):
        profile_ids = []
        for user in queryset:
            profile, _ = Profile.objects.get_or_create(user=user)
            profile_ids.append(profile.id)
        return Profile.objects.filter(id__in=profile_ids)

    @admin.action(description="Freeze selected accounts")
    def freeze_accounts(self, request, queryset):
        self._profiles_for_users(queryset).update(
            is_frozen=True,
            frozen_at=timezone.now(),
        )

    @admin.action(description="Unfreeze selected accounts")
    def unfreeze_accounts(self, request, queryset):
        self._profiles_for_users(queryset).update(
            is_frozen=False,
            frozen_at=None,
            frozen_reason="",
        )

    @admin.action(description="Convert selected accounts to Contractor")
    def make_contractors(self, request, queryset):
        self._profiles_for_users(queryset).update(
            profile_type=Profile.ProfileType.CONTRACTOR,
        )

    @admin.action(description="Convert selected accounts to Homeowner")
    def make_homeowners(self, request, queryset):
        self._profiles_for_users(queryset).update(
            profile_type=Profile.ProfileType.HOMEOWNER,
        )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        log_admin_event(
            request,
            AdminAuditLog.EventType.USER_UPDATED,
            target_user=obj,
            summary=f"{'Updated' if change else 'Created'} user {obj.username}",
            metadata={
                "is_staff": obj.is_staff,
                "is_active": obj.is_active,
                "is_superuser": obj.is_superuser,
            },
        )


@admin.register(HomeownerReferenceImage)
class HomeownerReferenceImageAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "caption", "is_public", "order", "created_at")
    list_filter = ("is_public", "created_at")
    search_fields = ("user__username", "caption")
    list_editable = ("is_public", "order")


@admin.register(DeletedEmailBlocklist)
class DeletedEmailBlocklistAdmin(admin.ModelAdmin):
    list_display = ("email", "reason", "created_at")
    search_fields = ("email", "reason")
    readonly_fields = ("created_at",)


@admin.register(StaffAccess)
class StaffAccessAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "role",
        "can_access_admin",
        "require_password_reset",
        "can_manage_accounts",
        "can_manage_moderation",
        "can_manage_verification",
        "can_manage_compliance",
        "last_reviewed_at",
    )
    list_filter = (
        "role",
        "can_access_admin",
        "require_password_reset",
        "can_manage_accounts",
        "can_manage_moderation",
        "can_manage_verification",
        "can_manage_compliance",
    )
    search_fields = ("user__username", "user__email", "notes")
    readonly_fields = ("created_at", "updated_at", "last_reviewed_at", "reviewed_by")

    fieldsets = (
        ("Staff member", {"fields": ("user", "role")}),
        (
            "Admin access",
            {
                "fields": (
                    "can_access_admin",
                    "require_password_reset",
                )
            },
        ),
        (
            "Operational permissions",
            {
                "fields": (
                    "can_manage_accounts",
                    "can_manage_moderation",
                    "can_manage_verification",
                    "can_manage_compliance",
                )
            },
        ),
        ("Review", {"fields": ("last_reviewed_at", "reviewed_by", "notes")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )

    def save_model(self, request, obj, form, change):
        obj.last_reviewed_at = timezone.now()
        obj.reviewed_by = request.user
        super().save_model(request, obj, form, change)
        log_admin_event(
            request,
            AdminAuditLog.EventType.STAFF_ACCESS_UPDATED,
            target_user=obj.user,
            target_obj=obj,
            summary=f"{'Updated' if change else 'Created'} staff access for {obj.user.username}",
            metadata={
                "role": obj.role,
                "can_access_admin": obj.can_access_admin,
                "require_password_reset": obj.require_password_reset,
            },
        )


@admin.register(UserReport)
class UserReportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "report_type",
        "priority",
        "status",
        "reporter",
        "target_user",
        "reviewed_by",
        "created_at",
    )
    list_filter = ("report_type", "priority", "status", "created_at")
    search_fields = (
        "subject",
        "details",
        "reporter__username",
        "reporter__email",
        "target_user__username",
        "target_user__email",
    )
    readonly_fields = ("created_at", "updated_at", "reviewed_at")
    autocomplete_fields = ("reporter", "target_user", "reviewed_by")

    fieldsets = (
        ("Report", {"fields": ("report_type", "priority", "status", "subject", "details", "source_url")}),
        ("People", {"fields": ("reporter", "target_user")}),
        ("Target object", {"fields": ("target_content_type", "target_object_id")}),
        ("Review", {"fields": ("reviewed_by", "reviewed_at", "resolution_notes")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )

    def save_model(self, request, obj, form, change):
        if obj.status in {UserReport.Status.IN_REVIEW, UserReport.Status.ESCALATED, UserReport.Status.RESOLVED, UserReport.Status.REJECTED}:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)
        log_admin_event(
            request,
            AdminAuditLog.EventType.REPORT_UPDATED,
            target_user=obj.target_user,
            target_obj=obj,
            summary=f"{'Updated' if change else 'Created'} report #{obj.pk}",
            metadata={"status": obj.status, "priority": obj.priority, "report_type": obj.report_type},
        )


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "action_type",
        "actor",
        "target_user",
        "report",
        "expires_at",
        "created_at",
    )
    list_filter = ("action_type", "created_at")
    search_fields = (
        "public_note",
        "internal_note",
        "actor__username",
        "target_user__username",
    )
    readonly_fields = ("created_at",)
    autocomplete_fields = ("actor", "target_user", "report")

    fieldsets = (
        ("Action", {"fields": ("action_type", "actor", "target_user", "report", "expires_at")}),
        ("Target object", {"fields": ("target_content_type", "target_object_id")}),
        ("Notes", {"fields": ("public_note", "internal_note")}),
        ("Audit", {"fields": ("created_at",)}),
    )

    def save_model(self, request, obj, form, change):
        if not obj.actor_id:
            obj.actor = request.user
        super().save_model(request, obj, form, change)
        log_admin_event(
            request,
            AdminAuditLog.EventType.MODERATION_ACTION,
            target_user=obj.target_user,
            target_obj=obj,
            summary=f"{'Updated' if change else 'Created'} moderation action #{obj.pk}",
            metadata={"action_type": obj.action_type, "report_id": obj.report_id},
        )


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "event_type", "actor", "target_user", "summary", "created_at")
    list_filter = ("event_type", "created_at")
    search_fields = ("summary", "actor__username", "target_user__username")
    readonly_fields = (
        "actor",
        "event_type",
        "target_user",
        "target_content_type",
        "target_object_id",
        "summary",
        "metadata",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AIConfiguration)
class AIConfigurationAdmin(admin.ModelAdmin):
    list_display = (
        "enabled",
        "project_helper_enabled",
        "bid_helper_enabled",
        "profile_helper_enabled",
        "daily_limit_per_user",
        "updated_at",
        "updated_by",
    )
    readonly_fields = ("updated_at", "updated_by")

    fieldsets = (
        ("Global control", {
            "fields": ("enabled", "daily_limit_per_user"),
            "description": "This is the default daily AI assist limit for every user unless a profile-level override is set.",
        }),
        ("Feature switches", {
            "fields": (
                "project_helper_enabled",
                "bid_helper_enabled",
                "profile_helper_enabled",
            ),
        }),
        ("Audit", {
            "fields": ("updated_at", "updated_by"),
        }),
    )

    def has_add_permission(self, request):
        if AIConfiguration.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(AIUsageEvent)
class AIUsageEventAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "feature",
        "model_name",
        "status",
        "request_day",
        "created_at",
    )
    list_filter = ("feature", "status", "request_day", "model_name")
    search_fields = ("user__username", "user__email", "model_name")
    readonly_fields = (
        "user",
        "feature",
        "model_name",
        "status",
        "prompt_chars",
        "response_chars",
        "request_day",
        "created_at",
    )

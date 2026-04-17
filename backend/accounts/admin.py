# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import AIConfiguration, AIUsageEvent, HomeownerReferenceImage, Profile

User = get_user_model()

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "email",
        "profile_type",
        "public_profile_enabled",
        "is_frozen",
        "frozen_at",
        "is_user_active",
    )
    list_editable = ("profile_type", "public_profile_enabled", "is_frozen")
    list_filter = ("profile_type", "public_profile_enabled", "is_frozen", "user__is_active")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("frozen_at",)
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
                "is_frozen",
                "frozen_at",
                "frozen_reason",
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


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    extra = 0
    fields = (
        "profile_type",
        "is_frozen",
        "frozen_at",
        "frozen_reason",
        "display_name",
        "service_location",
    )
    readonly_fields = ("frozen_at",)


try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = (ProfileInline,)
    list_display = (
        "id",
        "username",
        "email",
        "profile_type",
        "profile_frozen",
        "is_staff",
        "is_active",
    )
    list_filter = (
        "profile__profile_type",
        "profile__is_frozen",
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


@admin.register(HomeownerReferenceImage)
class HomeownerReferenceImageAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "caption", "is_public", "order", "created_at")
    list_filter = ("is_public", "created_at")
    search_fields = ("user__username", "caption")
    list_editable = ("is_public", "order")


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

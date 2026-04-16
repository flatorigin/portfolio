# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Profile

User = get_user_model()

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "email",
        "profile_type",
        "is_frozen",
        "frozen_at",
        "is_user_active",
    )
    list_editable = ("profile_type", "is_frozen")
    list_filter = ("profile_type", "is_frozen", "user__is_active")
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

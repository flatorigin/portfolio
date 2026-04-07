# backend/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Profile, ProfileLike, ProfileSave

User = get_user_model()


class ProfileBaseMixin:
    def _build_abs_url(self, request, url: str):
        if not url:
            return None
        return request.build_absolute_uri(url) if request else url

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        image = obj.avatar or obj.logo
        if image and hasattr(image, "url"):
            return self._build_abs_url(request, image.url)
        return None

    def get_banner_url(self, obj):
        request = self.context.get("request")
        image = obj.banner
        if image and hasattr(image, "url"):
            return self._build_abs_url(request, image.url)
        return None

    def get_like_count(self, obj):
        return ProfileLike.objects.filter(liked_user=obj.user).count()

    def get_liked_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return ProfileLike.objects.filter(
            liker=request.user,
            liked_user=obj.user,
        ).exists()

    def get_saved_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return ProfileSave.objects.filter(
            saver=request.user,
            saved_user=obj.user,
        ).exists()

    def validate_service_location(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Service area is required.")
        return value

    def validate_contact_email(self, value):
        value = (value or "").strip().lower()
        if not value:
            raise serializers.ValidationError("Email is required.")
        return value

    def validate_contact_phone(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        return value


class MeSerializer(ProfileBaseMixin, serializers.ModelSerializer):
    
    languages_display = serializers.ReadOnlyField()
    member_since_label = serializers.ReadOnlyField()

    # read-only user identity
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    avatar_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    saved_by_me = serializers.SerializerMethodField()

    is_profile_complete = serializers.ReadOnlyField()
    profile_status = serializers.ReadOnlyField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "email",
            "display_name",
            "service_location",
            "coverage_radius_miles",
            "contact_email",
            "contact_phone",
            "show_contact_email",
            "show_contact_phone",
            "bio",
            "logo",
            "avatar",
            "avatar_url",
            "banner",
            "banner_url",
            "like_count",
            "liked_by_me",
            "saved_by_me",
            "allow_direct_messages",
            "hero_headline",
            "hero_blurb",
            "is_profile_complete",
            "profile_status",
            "languages",
            "languages_display",
            "member_since_label",
            "dm_opt_out_reason",
            "dm_opt_out_until",
        ]
        read_only_fields = [
            "id",
            "username",
            "email",
            "avatar_url",
            "banner_url",
            "like_count",
            "liked_by_me",
            "saved_by_me",
            "is_profile_complete",
            "profile_status",
        ]

    def validate_languages(self, value):
        if isinstance(value, str):
            import json
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                raise serializers.ValidationError("Languages must be a list.")
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        service_location = attrs.get(
            "service_location",
            getattr(instance, "service_location", ""),
        )
        contact_email = attrs.get(
            "contact_email",
            getattr(instance, "contact_email", ""),
        )
        contact_phone = attrs.get(
            "contact_phone",
            getattr(instance, "contact_phone", ""),
        )

        if not str(service_location).strip():
            raise serializers.ValidationError(
                {"service_location": "Service area is required."}
            )
        if not str(contact_email).strip():
            raise serializers.ValidationError(
                {"contact_email": "Email is required."}
            )
        if not str(contact_phone).strip():
            raise serializers.ValidationError(
                {"contact_phone": "Phone number is required."}
            )

        return attrs


class ProfileSerializer(ProfileBaseMixin, serializers.ModelSerializer):
    languages_display = serializers.ReadOnlyField()
    member_since_label = serializers.ReadOnlyField()

    username = serializers.CharField(source="user.username", read_only=True)

    avatar_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    saved_by_me = serializers.SerializerMethodField()

    is_profile_complete = serializers.ReadOnlyField()
    profile_status = serializers.ReadOnlyField()

    class Meta:
        model = Profile
        fields = (
            "id",
            "username",
            "display_name",
            "service_location",
            "coverage_radius_miles",
            "bio",
            "contact_email",
            "contact_phone",
            "show_contact_email",
            "show_contact_phone",
            "logo",
            "avatar",
            "avatar_url",
            "banner",
            "banner_url",
            "like_count",
            "liked_by_me",
            "saved_by_me",
            "allow_direct_messages",
            "hero_headline",
            "hero_blurb",
            "is_profile_complete",
            "profile_status",
            "languages",
            "languages_display",
            "member_since_label",
        )
        read_only_fields = (
            "id",
            "username",
            "avatar_url",
            "banner_url",
            "like_count",
            "liked_by_me",
            "saved_by_me",
            "is_profile_complete",
            "profile_status",
        )

    def validate_languages(self, value):
        if isinstance(value, str):
            import json
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                raise serializers.ValidationError("Languages must be a list.")
        return value

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        service_location = attrs.get(
            "service_location",
            getattr(instance, "service_location", ""),
        )
        contact_email = attrs.get(
            "contact_email",
            getattr(instance, "contact_email", ""),
        )
        contact_phone = attrs.get(
            "contact_phone",
            getattr(instance, "contact_phone", ""),
        )

        if not str(service_location).strip():
            raise serializers.ValidationError(
                {"service_location": "Service area is required."}
            )
        if not str(contact_email).strip():
            raise serializers.ValidationError(
                {"contact_email": "Email is required."}
            )
        if not str(contact_phone).strip():
            raise serializers.ValidationError(
                {"contact_phone": "Phone number is required."}
            )

        return attrs


class PublicUserProfileSerializer(serializers.ModelSerializer):
    languages_display = serializers.ReadOnlyField()
    member_since_label = serializers.ReadOnlyField()

    username = serializers.CharField(source="user.username", read_only=True)

    avatar_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    contact_email = serializers.SerializerMethodField()
    contact_phone = serializers.SerializerMethodField()

    badge = serializers.SerializerMethodField()
    profile_status = serializers.ReadOnlyField()
    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    saved_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "display_name",
            "service_location",
            "coverage_radius_miles",
            "bio",
            "logo",
            "avatar",
            "banner",
            "avatar_url",
            "logo_url",
            "banner_url",
            "allow_direct_messages",
            "hero_headline",
            "hero_blurb",
            "contact_email",
            "contact_phone",
            "badge",
            "profile_status",
            "like_count",
            "liked_by_me",
            "saved_by_me",
            "languages",
            "languages_display",
            "member_since_label",
        ]

    def _build_abs_url(self, request, url: str):
        if not url:
            return None
        return request.build_absolute_uri(url) if request else url

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        image = obj.avatar or obj.logo
        if image and hasattr(image, "url"):
            return self._build_abs_url(request, image.url)
        return None

    def get_logo_url(self, obj):
        request = self.context.get("request")
        image = obj.logo or obj.avatar
        if image and hasattr(image, "url"):
            return self._build_abs_url(request, image.url)
        return None

    def get_banner_url(self, obj):
        request = self.context.get("request")
        image = obj.banner
        if image and hasattr(image, "url"):
            return self._build_abs_url(request, image.url)
        return None

    def get_contact_email(self, obj):
        return obj.contact_email if obj.show_contact_email else None

    def get_contact_phone(self, obj):
        return obj.contact_phone if obj.show_contact_phone else None

    def get_badge(self, obj):
        return "Profile Complete" if obj.is_profile_complete else "Incomplete Profile"

    def get_like_count(self, obj):
        return ProfileLike.objects.filter(liked_user=obj.user).count()

    def get_liked_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return ProfileLike.objects.filter(
            liker=request.user,
            liked_user=obj.user,
        ).exists()

    def get_saved_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return ProfileSave.objects.filter(
            saver=request.user,
            saved_user=obj.user,
        ).exists()

class LikedProfileCardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    tag = serializers.SerializerMethodField()
    bio_preview = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "display_name",
            "avatar_url",
            "tag",
            "bio_preview",
        ]

    def _abs(self, request, url: str):
        return request.build_absolute_uri(url) if request else url

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        image = obj.avatar or obj.logo
        if image and hasattr(image, "url"):
            return self._abs(request, image.url)
        return None

    def get_tag(self, obj):
        return (obj.service_location or "").strip()

    def get_bio_preview(self, obj):
        txt = (obj.bio or "").strip().splitlines()
        return (txt[0] if txt else "").strip()


class SavedProfileCardSerializer(LikedProfileCardSerializer):
    pass

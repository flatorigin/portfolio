# backend/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from djoser.serializers import UserCreateSerializer
from .models import DeletedEmailBlocklist, HomeownerReferenceImage, Profile, ProfileLike, ProfileSave

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


class HomeownerReferenceImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = HomeownerReferenceImage
        fields = [
            "id",
            "image",
            "image_url",
            "caption",
            "created_at",
            "order",
            "is_public",
        ]
        read_only_fields = ["id", "image_url", "created_at"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


class RoleAwareUserCreateSerializer(UserCreateSerializer):
    profile_type = serializers.ChoiceField(
        choices=Profile.ProfileType.choices,
        write_only=True,
    )

    class Meta(UserCreateSerializer.Meta):
        model = User
        fields = tuple(UserCreateSerializer.Meta.fields) + ("profile_type",)

    def validate(self, attrs):
        profile_type = attrs.get("profile_type")
        base_attrs = dict(attrs)
        base_attrs.pop("profile_type", None)
        validated = super().validate(base_attrs)
        email = str(validated.get("email") or attrs.get("email") or "").strip().lower()
        if email and DeletedEmailBlocklist.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"email": "This email address cannot be used to create a new account. Please contact the admin for help."}
            )
        if profile_type:
            validated["profile_type"] = profile_type
        return validated

    def create(self, validated_data):
        profile_type = validated_data.pop("profile_type")
        user = super().create(validated_data)
        Profile.objects.update_or_create(
            user=user,
            defaults={"profile_type": profile_type},
        )
        return user


class AIAssistSerializer(serializers.Serializer):
    feature = serializers.ChoiceField(
        choices=[
            "project_summary",
            "project_checklist",
            "bid_proposal",
            "profile_headline",
            "profile_blurb",
            "profile_bio",
        ]
    )
    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    category = serializers.CharField(required=False, allow_blank=True, max_length=120)
    location = serializers.CharField(required=False, allow_blank=True, max_length=200)
    budget = serializers.CharField(required=False, allow_blank=True, max_length=80)
    timeline = serializers.CharField(required=False, allow_blank=True, max_length=120)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    current_text = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    audience = serializers.CharField(required=False, allow_blank=True, max_length=80)
    price_type = serializers.CharField(required=False, allow_blank=True, max_length=40)
    included_text = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    excluded_text = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    payment_terms = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)
    new_password_confirm = serializers.CharField(write_only=True, trim_whitespace=False, min_length=8)

    def validate_current_password(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs.get("new_password") != attrs.get("new_password_confirm"):
            raise serializers.ValidationError(
                {"new_password_confirm": "New passwords do not match."}
            )
        return attrs


class AccountDeleteSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.check_password(value):
            raise serializers.ValidationError("Password is incorrect.")
        return value


class MeSerializer(ProfileBaseMixin, serializers.ModelSerializer):
    
    languages_display = serializers.ReadOnlyField()
    member_since_label = serializers.ReadOnlyField()

    # read-only user identity
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)
    email_verified = serializers.BooleanField(source="is_email_verified", read_only=True)
    is_deactivated = serializers.BooleanField(read_only=True)
    deactivated_at = serializers.DateTimeField(read_only=True)

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
            "email_verified",
            "profile_type",
            "display_name",
            "service_location",
            "coverage_radius_miles",
            "contact_email",
            "contact_phone",
            "show_contact_email",
            "show_contact_phone",
            "public_profile_enabled",
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
            "is_deactivated",
            "deactivated_at",
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
    email = serializers.EmailField(source="user.email", read_only=True)
    email_verified = serializers.BooleanField(source="is_email_verified", read_only=True)

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
            "email",
            "email_verified",
            "profile_type",
            "display_name",
            "service_location",
            "coverage_radius_miles",
            "bio",
            "contact_email",
            "contact_phone",
            "show_contact_email",
            "show_contact_phone",
            "public_profile_enabled",
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
            "is_frozen",
            "is_deactivated",
            "deactivated_at",
        )
        read_only_fields = (
            "id",
            "username",
            "email",
            "email_verified",
            "avatar_url",
            "banner_url",
            "like_count",
            "liked_by_me",
            "saved_by_me",
            "is_profile_complete",
            "profile_status",
            "is_frozen",
            "is_deactivated",
            "deactivated_at",
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

        toggle_only_fields = {
            "profile_type",
            "public_profile_enabled",
            "allow_direct_messages",
            "show_contact_email",
            "show_contact_phone",
        }
        if attrs and set(attrs.keys()).issubset(toggle_only_fields):
            return attrs

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
    reference_gallery = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "profile_type",
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
            "reference_gallery",
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

    def get_reference_gallery(self, obj):
        items = obj.user.homeowner_reference_images.filter(is_public=True)
        return HomeownerReferenceImageSerializer(
            items,
            many=True,
            context=self.context,
        ).data

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


class ContractorSearchResultSerializer(ProfileBaseMixin, serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    member_since_label = serializers.ReadOnlyField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "display_name",
            "service_location",
            "bio",
            "hero_headline",
            "avatar_url",
            "logo_url",
            "member_since_label",
        ]

    def get_logo_url(self, obj):
        request = self.context.get("request")
        image = obj.logo or obj.avatar
        if image and hasattr(image, "url"):
            return self._build_abs_url(request, image.url)
        return None

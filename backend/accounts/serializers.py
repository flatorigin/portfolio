# backend/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Profile, ProfileLike

User = get_user_model()


class MeSerializer(serializers.ModelSerializer):
    # read-only user identity
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    avatar_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()

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
            "bio",
            "logo",
            "avatar",
            "avatar_url",
            "banner",
            "banner_url",
            "like_count",
            "liked_by_me",
            "allow_direct_messages",
        ]
        read_only_fields = ["id", "username", "email", "avatar_url", "banner_url", "like_count", "liked_by_me"]

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
        return ProfileLike.objects.filter(liker=request.user, liked_user=obj.user).exists()


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    avatar_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()

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
            "logo",
            "avatar",
            "avatar_url",
            "banner",
            "banner_url",
            "like_count",
            "liked_by_me",
            "allow_direct_messages",
        )
        read_only_fields = ("id", "username", "avatar_url", "banner_url", "like_count", "liked_by_me")

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
        return ProfileLike.objects.filter(liker=request.user, liked_user=obj.user).exists()

class LikedProfileCardSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    # “small tag category below the name” → use service_location
    tag = serializers.SerializerMethodField()

    # used for tooltip
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
        # first line only
        txt = (obj.bio or "").strip().splitlines()
        return (txt[0] if txt else "").strip()
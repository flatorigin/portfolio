# backend/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Profile

User = get_user_model()

class MeSerializer(serializers.ModelSerializer):
    # read-only user identity
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "email",
            "display_name",
            "service_location",
            "coverage_radius_miles",
            "contact_email",      # NEW
            "contact_phone",      # NEW
            "bio",
            "logo",
            "avatar",
            "avatar_url",
        ]
        read_only_fields = ["id", "username", "email", "avatar_url"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.logo and hasattr(obj.logo, "url"):
            return (
                request.build_absolute_uri(obj.logo.url)
                if request
                else obj.logo.url
            )
        return None

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)


class ProfileSerializer(serializers.ModelSerializer):
    # expose username from related User
    username = serializers.CharField(source="user.username", read_only=True)

    # computed URLs for images
    avatar_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

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
            "banner",      # raw file field (for /users/me/ write)
            "banner_url",  # absolute URL for public hero
        )

    def _build_abs_url(self, request, url: str):
        if not url:
            return None
        return request.build_absolute_uri(url) if request else url

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        # prefer explicit avatar, fall back to logo
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
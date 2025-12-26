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
    banner_url = serializers.SerializerMethodField()

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
            "banner",
            "banner_url",
        ]
        read_only_fields = ["id", "username", "email", "avatar_url", "banner_url"]

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

    def get_banner_url(self, obj):
        request = self.context.get("request")
        banner = getattr(obj, "banner", None)
        if banner and hasattr(banner, "url"):
            return request.build_absolute_uri(banner.url) if request else banner.url
        return None


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()  # 👈 NEW

    class Meta:
        model = Profile
        fields = [
            "id",
            "username",
            "display_name",
            "service_location",
            "contact_email",      # NEW
            "contact_phone",      # NEW
            "logo",
            "avatar_url",
            "banner_url",  # 👈 NEW
        ]
        read_only_fields = fields

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.logo and hasattr(obj.logo, "url"):
            return (
                request.build_absolute_uri(obj.logo.url)
                if request
                else obj.logo.url
            )
        return None

    def get_banner_url(self, obj):
        """
        Return an absolute URL for the hero/banner image, if it exists.
        IMPORTANT: change 'banner' below if your Profile model uses a different field name.
        """
        request = self.context.get("request")
        banner = getattr(obj, "banner", None)  # 👈 if your field is Profile.banner

        if banner and hasattr(banner, "url"):
            url = banner.url
            return request.build_absolute_uri(url) if request else url
        return None

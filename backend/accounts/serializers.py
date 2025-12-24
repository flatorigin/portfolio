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
            "hero_image",
            "hero_image_url",
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
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()

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
            "hero_image",
            "hero_image_url",
            "avatar_url",
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

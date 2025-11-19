# backend/accounts/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Profile

User = get_user_model()

class MeSerializer(serializers.ModelSerializer):
    # expose username for convenience
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Profile
        fields = (
            "username",
            "display_name",
            "service_location",
            "coverage_radius_miles",
            "bio",
            "logo",     # file field
        )

    def update(self, instance, validated_data):
        # keep simple: partial updates accepted
        return super().update(instance, validated_data)

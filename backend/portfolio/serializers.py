# backend/portfolio/serializers.py
from rest_framework import serializers
from .models import Project, ProjectImage


class ProjectImageSerializer(serializers.ModelSerializer):
    url = serializers.ImageField(source="image", read_only=True)

    class Meta:
        model = ProjectImage
        fields = (
            "id",
            "project",
            "image",
            "url",
            "caption",
            "alt_text",
            "extra_data",
            "order",
            "created_at",
        )
        read_only_fields = ("project", "created_at")


class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    images = ProjectImageSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "owner",
            "owner_username",
            "title",
            "summary",
            "category",
            "cover_image",
            "is_public",
            "tech_stack",
            "location",
            "budget",
            "sqf",
            "highlights",
            "created_at",
            "updated_at",
            "images",
        )
        read_only_fields = (
            "id",
            "owner",
            "owner_username",
            "created_at",
            "updated_at",
            "images",
        )

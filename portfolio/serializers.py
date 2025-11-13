from rest_framework import serializers
from .models import Project, ProjectImage

class ProjectImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectImage
        fields = "__all__"
        read_only_fields = ("project","created_at")

class ProjectSerializer(serializers.ModelSerializer):
    images = ProjectImageSerializer(many=True, read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    class Meta:
        model = Project
        fields = (
            "id","owner_username","title","summary","category","cover_image",
            "is_public","tech_stack","created_at","updated_at","images"
        )

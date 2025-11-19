from rest_framework import serializers
from .models import Project, ProjectImage

# class ProjectImageSerializer(serializers.ModelSerializer):
#     url = serializers.ImageField(source="image", read_only=True)  # absolute if context has request
#     class Meta:
#         model = ProjectImage
#         fields = "__all__"    # includes image, caption, order, project, id, created_at, plus url
#         read_only_fields = ("project","created_at")

#     class ProjectImageSerializer(serializers.ModelSerializer):
#         url = serializers.ImageField(source="image", read_only=True)
#         class Meta:
#             model = ProjectImage
#             fields = "__all__"
#             read_only_fields = ("project","created_at")

#     class ProjectSerializer(serializers.ModelSerializer):
#         images = ProjectImageSerializer(many=True, read_only=True)
#         owner_username = serializers.CharField(source="owner.username", read_only=True)

#         class Meta:
#             model = Project
#             fields = (
#                 "id","owner_username",
#                 "title","summary","category","cover_image","is_public","tech_stack",
#                 "location","budget","sqf","highlights",
#                 "created_at","updated_at",
#                 "images"
#             )
#             extra_kwargs = {
#                 # Only 'title' must be present; everything else is optional
#                 "summary":   {"required": False, "allow_blank": True},
#                 "category":  {"required": False, "allow_blank": True},
#                 "cover_image": {"required": False},
#                 "is_public": {"required": False},
#                 "tech_stack":{"required": False, "allow_blank": True},
#                 "location":  {"required": False, "allow_blank": True},
#                 "budget":    {"required": False, "allow_blank": True},
#                 "sqf":       {"required": False},  # allow null/blank in model
#                 "highlights":{"required": False, "allow_blank": True},
#             }



from rest_framework import serializers
from .models import Project, ProjectImage

class ProjectImageSerializer(serializers.ModelSerializer):
    url = serializers.ImageField(source="image", read_only=True)
    class Meta:
        model = ProjectImage
        fields = "__all__"
        read_only_fields = ("project", "created_at")

class ProjectSerializer(serializers.ModelSerializer):
    images = ProjectImageSerializer(many=True, read_only=True)
    owner_username = serializers.CharField(source="owner.username", read_only=True)

    class Meta:
        model = Project
        fields = (
            "id",
            "owner_username",
            "title",
            "summary",
            "category",
            "cover_image",
            "is_public",
            "tech_stack",
            # ✅ new fields now backed by the model
            "location",
            "budget",
            "sqf",
            "highlights",
            "created_at",
            "updated_at",
            "images",
        )
        read_only_fields = ("id", "owner_username", "created_at", "updated_at", "images")

# backend/portfolio/serializers.py
from rest_framework import serializers
from .models import ProjectComment, Project, ProjectImage, MessageThread, PrivateMessage
from accounts.serializers import ProfileSerializer


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

class ProjectCommentSerializer(serializers.ModelSerializer):
    author_username = serializers.ReadOnlyField(source="author.username")
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = ProjectComment
        fields = [
            "id",
            "project",
            "author_username",
            "is_owner",
            "text",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "author_username",
            "is_owner",
            "created_at",
        ]

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and request.user == obj.author
        )

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


class PrivateMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.ReadOnlyField(source="sender.username")
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = PrivateMessage
        fields = [
            "id",
            "thread",
            "sender",
            "sender_username",
            "text",
            "attachment",
            "attachment_name",
            "attachment_type",
            "attachment_url",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "sender",
            "thread",
            "sender_username",
            "attachment_url",
            "created_at",
        ]

    def get_attachment_url(self, obj):
        request = self.context.get("request")
        if obj.attachment and hasattr(obj.attachment, "url"):
            url = obj.attachment.url
            return request.build_absolute_uri(url) if request else url
        return None

    def validate(self, attrs):
        attachment = self.initial_data.get("attachment")
        text = attrs.get("text", "").strip()

        if not text and not attachment:
            raise serializers.ValidationError("Message must include text or an attachment.")

        if attachment:
            allowed_doc_ext = {"pdf", "doc", "docx", "xls", "xlsx"}
            allowed_image_ext = {"jpg", "jpeg", "png"}

            ext = (attachment.name or "").rsplit(".", 1)[-1].lower()
            if ext not in allowed_doc_ext.union(allowed_image_ext):
                raise serializers.ValidationError("Unsupported attachment type.")

            if ext in allowed_image_ext and attachment.size > 3 * 1024 * 1024:
                raise serializers.ValidationError("Images cannot exceed 3MB.")

            if ext in allowed_doc_ext and attachment.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Documents cannot exceed 5MB.")

            # Set attachment type hints
            attrs["attachment_name"] = attachment.name
            attrs["attachment_type"] = "image" if ext in allowed_image_ext else "document"

        return attrs


class MessageThreadSerializer(serializers.ModelSerializer):
    project_title = serializers.ReadOnlyField(source="project.title")
    owner_username = serializers.ReadOnlyField(source="owner.username")
    client_username = serializers.ReadOnlyField(source="client.username")
    latest_message = serializers.SerializerMethodField()
    owner_profile = ProfileSerializer(source="owner.profile", read_only=True)
    client_profile = ProfileSerializer(source="client.profile", read_only=True)

    class Meta:
        model = MessageThread
        fields = [
            "id",
            "project",
            "project_title",
            "owner",
            "owner_username",
            "owner_profile",
            "client",
            "client_username",
            "client_profile",
            "created_at",
            "updated_at",
            "latest_message",
        ]
        read_only_fields = [
            "id",
            "project",
            "owner",
            "owner_username",
            "owner_profile",
            "client",
            "client_username",
            "client_profile",
            "created_at",
            "updated_at",
            "latest_message",
        ]

    def get_latest_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if not msg:
            return None
        return PrivateMessageSerializer(msg, context=self.context).data
from rest_framework import serializers
from accounts.serializers import ProfileSerializer
from .models import ProjectComment, Project, ProjectImage, MessageThread, PrivateMessage, ProjectFavorite
from django.contrib.auth import get_user_model

User = get_user_model()

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
            "material_url",
            "material_label",
            "extra_links",  # 🔹 NEW
        )
        read_only_fields = (
            "id",
            "owner",
            "owner_username",
            "created_at",
            "updated_at",
            "images",
        )

# ADD THIS NEW SERIALIZER NEAR YOUR OTHER MODEL SERIALIZERS
class ProjectFavoriteSerializer(serializers.ModelSerializer):
    """
    Favorite entry + nested project.
    Response example:
    {
      "id": 5,
      "created_at": "...",
      "project": { ... ProjectSerializer fields ... }
    }
    """
    project = ProjectSerializer(read_only=True)

    class Meta:
        model = ProjectFavorite
        fields = ["id", "project", "created_at"]


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
        # Important: we use initial_data here to access the raw file
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

class PublicUserSerializer(serializers.ModelSerializer):
    """Public-friendly projection of a user + their profile fields."""

    # Profile-driven fields
    company_name = serializers.CharField(source="profile.company_name", read_only=True)
    full_name = serializers.SerializerMethodField()
    bio = serializers.CharField(source="profile.bio", read_only=True)
    location = serializers.CharField(source="profile.location", read_only=True)
    contact_email = serializers.EmailField(source="profile.contact_email", read_only=True)
    contact_phone = serializers.CharField(source="profile.contact_phone", read_only=True)

    # Asset URLs
    logo_url = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "username",
            "full_name",
            "company_name",
            "bio",
            "location",
            "contact_email",
            "contact_phone",
            "logo_url",
            "banner_url",
        ]

    def get_full_name(self, obj):
        display = (obj.profile.display_name or "").strip()
        if display:
            return display
        full = obj.get_full_name().strip()
        return full or obj.username

    def _abs_url(self, maybe_field):
        if not maybe_field:
            return None

        request = self.context.get("request")
        url = getattr(maybe_field, "url", None)
        if not url:
            return None
        return request.build_absolute_uri(url) if request else url

    def get_logo_url(self, obj):
        return self._abs_url(obj.profile.logo)

    def get_banner_url(self, obj):
        return self._abs_url(obj.profile.banner)

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
            # 🔹 flags needed for Accept / Block buttons
            "owner_has_accepted",
            "client_has_accepted",
            "owner_archived",
            "client_archived",
            "owner_blocked_client",
            "client_blocked_owner",
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
            "owner_has_accepted",
            "client_has_accepted",
            "owner_archived",
            "client_archived",
            "owner_blocked_client",
            "client_blocked_owner",
            "created_at",
            "updated_at",
            "latest_message",
        ]

    def get_latest_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if not msg:
            return None
        return PrivateMessageSerializer(msg, context=self.context).data


    def get_unread_count(self, obj):
        """
        Stub for now: always 0.
        If you later add per-user read tracking on messages, compute it here.

        Example (if you add a method on the model):
            user = self.context["request"].user
            return obj.unread_count_for(user)
        """
        return 0

    def get_is_request(self, obj):
        """
        True if, for the current user, this thread is still a "message request"
        (i.e. they haven't accepted it yet).
        Requires the model to have `owner_has_accepted` and `client_has_accepted`.
        """
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False  # inbox is auth-only, but be safe

        user = request.user
        uid = user.id

        # If model doesn't yet have these flags, default to False
        owner_accepted = getattr(obj, "owner_has_accepted", True)
        client_accepted = getattr(obj, "client_has_accepted", True)

        if uid == obj.owner_id:
            return not bool(owner_accepted)
        if uid == obj.client_id:
            return not bool(client_accepted)
        # non-participant: treat as not a request
        return False

    def get_counterpart(self, obj):
        """
        Return a compact representation of the *other* user in this thread,
        with fields tuned for the GlobalInbox UI:

        {
            "username": "...",
            "display_name": "...",
            "avatar_url": "..."
        }
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            # default to owner as counterpart if anonymous (should not happen)
            other = obj.client
        else:
            if user.id == obj.owner_id:
                other = obj.client
            elif user.id == obj.client_id:
                other = obj.owner
            else:
                # not a participant; default to owner
                other = obj.owner

        prof = getattr(other, "profile", None)
        # We rely on ProfileSerializer to expose avatar/urls, but we keep this simple
        avatar_url = None
        display_name = None

        if prof is not None:
            # ProfileSerializer usually exposes display_name and avatar_url;
            # but to avoid an extra serializer call, we read from model directly.
            display_name = getattr(prof, "display_name", "") or other.username
            # Try both logo and avatar (depends on your ProfileSerializer)
            if getattr(prof, "logo", None) and hasattr(prof.logo, "url"):
                avatar_url = prof.logo.url
            elif getattr(prof, "avatar", None) and hasattr(prof.avatar, "url"):
                avatar_url = prof.avatar.url
        else:
            display_name = other.username

        return {
            "username": other.username,
            "display_name": display_name,
            "avatar_url": avatar_url,
        }

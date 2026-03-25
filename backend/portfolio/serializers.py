# =============================================================================
# file: backend/portfolio/serializers.py
# =============================================================================
from rest_framework import serializers
from django.utils import timezone
from accounts.serializers import ProfileSerializer

from .models import (
    ProjectComment,
    Project,
    ProjectImage,
    MessageThread,
    PrivateMessage,
    ProjectFavorite,
)



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
            "rating",
            "is_testimonial",
            "testimonial_published",
            "testimonial_published_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "author_username",
            "is_owner",
            "created_at",
            "testimonial_published",
            "testimonial_published_at",
        ]

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and request.user == obj.author)


class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    images = ProjectImageSerializer(many=True, read_only=True)

    cover_image_url = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    cover_image_ref = serializers.PrimaryKeyRelatedField(
        queryset=ProjectImage.objects.all(),
        required=False,
        allow_null=True,
    )
    cover_image_file = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "owner_username",
            "is_owner",
            "title",
            "summary",
            "category",
            "is_public",
            "is_job_posting",
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
            "extra_links",

            # job-posting extensions
            "job_summary",
            "service_categories",
            "part_of_larger_project",
            "larger_project_details",
            "required_expertise",
            "permit_required",
            "permit_responsible_party",
            "compliance_confirmed",
            "post_privacy",
            "private_contractor_username",
            "notify_by_email",
            "job_is_published",

            # cover fields
            "cover_image_ref",
            "cover_image_file",

            # derived
            "cover_image_url",
        ]
        read_only_fields = [
            "id",
            "owner",
            "owner_username",
            "created_at",
            "updated_at",
            "images",
            "cover_image_url",
        ]

    def validate_service_categories(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("service_categories must be a list.")
        cleaned = []
        for item in value:
            if isinstance(item, str) and item.strip():
                cleaned.append(item.strip())
        return cleaned

    def validate(self, attrs):
        """
        ✅ Auto-copy summary -> job_summary when job posting is on,
        but only if job_summary isn't explicitly provided.
        Works for both create and update.
        """
        # Determine effective job flag (attrs may omit it on PATCH)
        instance = getattr(self, "instance", None)
        is_job_posting = attrs.get(
            "is_job_posting",
            getattr(instance, "is_job_posting", False) if instance else False,
        )

        # If job posting is on, and job_summary not provided, use summary if provided
        if is_job_posting:
            incoming_job_summary = attrs.get("job_summary", None)
            incoming_summary = attrs.get("summary", None)

            if (incoming_job_summary is None or str(incoming_job_summary).strip() == "") and (
                incoming_summary is not None and str(incoming_summary).strip() != ""
            ):
                attrs["job_summary"] = incoming_summary

            # Also: ensure JSON list default if omitted
            if "service_categories" in attrs and attrs["service_categories"] is None:
                attrs["service_categories"] = []

        """
        ✅ Auto-copy summary -> job_summary when job posting is on,
        but only if job_summary isn't explicitly provided.
        Works for both create and update.
        """
        # Determine effective job flag (attrs may omit it on PATCH)
        instance = getattr(self, "instance", None)
        is_job_posting = attrs.get(
            "is_job_posting",
            getattr(instance, "is_job_posting", False) if instance else False,
        )

        # If job posting is on, and job_summary not provided, use summary if provided
        if is_job_posting:
            incoming_job_summary = attrs.get("job_summary", None)
            incoming_summary = attrs.get("summary", None)

            if (incoming_job_summary is None or str(incoming_job_summary).strip() == "") and (
                incoming_summary is not None and str(incoming_summary).strip() != ""
            ):
                attrs["job_summary"] = incoming_summary

            # Also: ensure JSON list default if omitted
            if "service_categories" in attrs and attrs["service_categories"] is None:
                attrs["service_categories"] = []

        return attrs

    def get_cover_image_url(self, obj):
        """
        Cover priority:
        1) first ProjectImage by order (your convention)
        2) cover_image_file if set
        """
        request = self.context.get("request")

        cover = obj.images.order_by("order", "id").first()
        if cover and cover.image and hasattr(cover.image, "url"):
            url = cover.image.url
            return request.build_absolute_uri(url) if request else url

        file_field = getattr(obj, "cover_image_file", None)
        if file_field and hasattr(file_field, "url"):
            url = file_field.url
            return request.build_absolute_uri(url) if request else url

        return None

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(
            request and request.user.is_authenticated and obj.owner_id == request.user.id
        )


class ProjectFavoriteSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source="project.id", read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    project_summary = serializers.CharField(source="project.summary", read_only=True)
    project_category = serializers.CharField(source="project.category", read_only=True)
    project_owner_username = serializers.CharField(source="project.owner.username", read_only=True)
    project_location = serializers.CharField(source="project.location", read_only=True)
    project_budget = serializers.CharField(source="project.budget", read_only=True)
    project_sqf = serializers.CharField(source="project.sqf", read_only=True)
    project_highlights = serializers.CharField(source="project.highlights", read_only=True)
    project_cover_image = serializers.SerializerMethodField()

    class Meta:
        model = ProjectFavorite
        fields = (
            "id",
            "created_at",
            "project_id",
            "project_title",
            "project_summary",
            "project_category",
            "project_owner_username",
            "project_location",
            "project_budget",
            "project_sqf",
            "project_highlights",
            "project_cover_image",
        )

    def get_project_cover_image(self, obj):
        request = self.context.get("request")

        cover = obj.project.images.order_by("order", "id").first()
        if cover and cover.image and hasattr(cover.image, "url"):
            url = cover.image.url
            return request.build_absolute_uri(url) if request else url

        file_field = getattr(obj.project, "cover_image_file", None)
        if file_field and hasattr(file_field, "url"):
            url = file_field.url
            return request.build_absolute_uri(url) if request else url

        return None


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
        """
        Auto-copy summary -> job_summary when job posting is on,
        but only if job_summary isn't explicitly provided.
        Works for both create and update.
        """
        instance = getattr(self, "instance", None)

        is_job_posting = attrs.get(
            "is_job_posting",
            getattr(instance, "is_job_posting", False) if instance else False,
        )

        if is_job_posting:
            incoming_job_summary = attrs.get("job_summary", None)
            incoming_summary = attrs.get("summary", None)

            if (incoming_job_summary is None or str(incoming_job_summary).strip() == "") and (
                incoming_summary is not None and str(incoming_summary).strip() != ""
            ):
                attrs["job_summary"] = incoming_summary

            # normalize JSON list if explicitly passed as null
            if "service_categories" in attrs and attrs["service_categories"] is None:
                attrs["service_categories"] = []

        return attrs

class MessageThreadSerializer(serializers.ModelSerializer):
    project_title = serializers.ReadOnlyField(source="project.title")
    owner_username = serializers.ReadOnlyField(source="owner.username")
    client_username = serializers.ReadOnlyField(source="client.username")

    latest_message = serializers.SerializerMethodField()
    owner_profile = ProfileSerializer(source="owner.profile", read_only=True)
    client_profile = ProfileSerializer(source="client.profile", read_only=True)

    # ✅ stable flags for frontend
    is_request = serializers.SerializerMethodField()
    can_reply = serializers.SerializerMethodField()
    ignored_until = serializers.SerializerMethodField()
    blocked = serializers.SerializerMethodField()

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

            "owner_has_accepted",
            "client_has_accepted",
            "owner_archived",
            "client_archived",
            "owner_blocked_client",
            "client_blocked_owner",

            # ✅ new flags
            "is_request",
            "can_reply",
            "ignored_until",
            "blocked",

            "created_at",
            "updated_at",
            "latest_message",
        ]
        read_only_fields = fields

    def get_latest_message(self, obj):
        msg = obj.messages.order_by("-created_at").first()
        if not msg:
            return None
        return PrivateMessageSerializer(msg, context=self.context).data

    def _current_user(self):
        request = self.context.get("request")
        u = getattr(request, "user", None)
        return u if u and u.is_authenticated else None

    def get_is_request(self, obj):
        """
        For the CURRENT user: True if they have NOT accepted yet.
        """
        user = self._current_user()
        if not user:
            return False
        return not bool(obj.user_has_accepted(user))

    def get_can_reply(self, obj):
        """
        For the CURRENT user: can they send a message right now?
        - must be participant
        - not blocked
        - must have accepted
        - must not be inside ignore-window (if other side ignored)
        """
        user = self._current_user()
        if not user:
            return False
        if not obj.user_is_participant(user):
            return False
        if obj.is_blocked_for(user):
            return False
        if not obj.user_has_accepted(user):
            return False

        # if recipient ignored this request, enforce throttle
        other = obj.client if user.id == obj.owner_id else obj.owner
        ignored_until = obj.ignored_until_for(other)
        if (not obj.user_has_accepted(other)) and ignored_until and timezone.now() < ignored_until:
            return False

        return True

    def get_ignored_until(self, obj):
        """
        Return ignore-until timestamp for the OTHER user (so sender can know cooldown).
        """
        user = self._current_user()
        if not user or not obj.user_is_participant(user):
            return None

        other = obj.client if user.id == obj.owner_id else obj.owner
        val = obj.ignored_until_for(other)
        return val

    def get_blocked(self, obj):
        user = self._current_user()
        if not user:
            return False
        return bool(obj.is_blocked_for(user))
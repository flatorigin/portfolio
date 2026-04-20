# =============================================================================
# file: backend/portfolio/serializers.py
# =============================================================================
from datetime import timedelta
import json
import re

from rest_framework import serializers
from django.utils import timezone
from django.contrib.auth import get_user_model
from accounts.serializers import ProfileSerializer

from .models import (
    ProjectComment,
    Project,
    ProjectImage,
    ProjectPlan,
    ProjectPlanImage,
    MessageThread,
    PrivateMessage,
    ProjectFavorite,
    ProjectLike,
    MessageAttachment,
    ProjectInvite,
    ProjectBid,
    ProjectBidVersion,
)

User = get_user_model()
COMMENT_CHAR_LIMIT = 280
URL_PATTERN = re.compile(r"(https?://|www\.)", re.IGNORECASE)


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


class ProjectPlanImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPlanImage
        fields = (
            "id",
            "project_plan",
            "image",
            "image_url",
            "caption",
            "order",
            "is_cover",
            "created_at",
        )
        read_only_fields = ("project_plan", "created_at", "image_url")

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


class ProjectPlanSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    images = ProjectPlanImageSerializer(many=True, read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    active_plan_count = serializers.SerializerMethodField()
    max_active_plans = serializers.SerializerMethodField()
    ai_remaining_today = serializers.SerializerMethodField()
    ai_daily_limit = serializers.SerializerMethodField()
    can_generate_draft = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPlan
        fields = [
            "id",
            "owner",
            "owner_username",
            "title",
            "issue_summary",
            "house_location",
            "priority",
            "budget_min",
            "budget_max",
            "notes",
            "status",
            "visibility",
            "contractor_types",
            "links",
            "options",
            "selected_option_key",
            "ai_generated_issue_summary",
            "ai_suggested_contractor_types",
            "converted_job_post",
            "created_at",
            "updated_at",
            "images",
            "cover_image_url",
            "active_plan_count",
            "max_active_plans",
            "ai_remaining_today",
            "ai_daily_limit",
            "can_generate_draft",
        ]
        read_only_fields = [
            "id",
            "owner",
            "owner_username",
            "visibility",
            "ai_generated_issue_summary",
            "ai_suggested_contractor_types",
            "converted_job_post",
            "created_at",
            "updated_at",
            "images",
            "cover_image_url",
            "active_plan_count",
            "max_active_plans",
            "ai_remaining_today",
            "ai_daily_limit",
            "can_generate_draft",
        ]

    def _normalize_string_list(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Expected a list.")
        cleaned = []
        seen = set()
        for item in value:
            text = str(item or "").strip()
            key = text.lower()
            if text and key not in seen:
                cleaned.append(text)
                seen.add(key)
        return cleaned

    def validate_contractor_types(self, value):
        return self._normalize_string_list(value)

    def validate_links(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Links must be a list.")
        cleaned = []
        for item in value:
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            label = str(item.get("label") or "").strip()
            notes = str(item.get("notes") or "").strip()
            if not url:
                continue
            cleaned.append({"url": url, "label": label, "notes": notes})
        return cleaned

    def validate_options(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Options must be a list.")
        cleaned = []
        seen = set()
        for idx, item in enumerate(value):
            if not isinstance(item, dict):
                continue
            key = str(item.get("key") or f"option-{idx + 1}").strip()[:80]
            title = str(item.get("title") or "").strip()
            notes = str(item.get("notes") or "").strip()
            pros = str(item.get("pros") or "").strip()
            cons = str(item.get("cons") or "").strip()
            estimated_cost_note = str(item.get("estimated_cost_note") or "").strip()
            if not title:
                continue
            if key in seen:
                key = f"{key}-{idx + 1}"
            seen.add(key)
            cleaned.append(
                {
                    "key": key,
                    "title": title,
                    "notes": notes,
                    "pros": pros,
                    "cons": cons,
                    "estimated_cost_note": estimated_cost_note,
                    "is_selected": bool(item.get("is_selected")),
                }
            )
        return cleaned

    def validate_selected_option_key(self, value):
        return str(value or "").strip()[:80]

    def validate_status(self, value):
        value = str(value or "").strip()
        allowed = {
            ProjectPlan.STATUS_PLANNING,
            ProjectPlan.STATUS_READY_TO_DRAFT,
            ProjectPlan.STATUS_CONVERTED,
            ProjectPlan.STATUS_ARCHIVED,
        }
        if value not in allowed:
            raise serializers.ValidationError("Invalid project plan status.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        instance = getattr(self, "instance", None)

        selected_key = attrs.get(
            "selected_option_key",
            getattr(instance, "selected_option_key", ""),
        )
        options = attrs.get("options", getattr(instance, "options", []))
        option_keys = {item.get("key") for item in options if isinstance(item, dict)}
        if selected_key and selected_key not in option_keys:
            raise serializers.ValidationError(
                {"selected_option_key": "Choose one of the saved solution options."}
            )

        if attrs.get("budget_min") and attrs.get("budget_max"):
            if attrs["budget_min"] > attrs["budget_max"]:
                raise serializers.ValidationError(
                    {"budget_max": "Budget max must be greater than or equal to budget min."}
                )

        if not instance and request and request.user.is_authenticated:
            active_count = ProjectPlan.objects.filter(
                owner=request.user,
                status__in=[ProjectPlan.STATUS_PLANNING, ProjectPlan.STATUS_READY_TO_DRAFT],
            ).count()
            if active_count >= 3:
                raise serializers.ValidationError(
                    {
                        "detail": "You can keep up to 3 project plans at a time. Remove one to add another."
                    }
                )

        return attrs

    def get_cover_image_url(self, obj):
        request = self.context.get("request")
        cover = obj.images.filter(is_cover=True).first() or obj.images.order_by("order", "id").first()
        if cover and cover.image and hasattr(cover.image, "url"):
            return request.build_absolute_uri(cover.image.url) if request else cover.image.url
        return None

    def get_active_plan_count(self, obj):
        return self.context.get("active_plan_count")

    def get_max_active_plans(self, obj):
        return 3

    def get_ai_remaining_today(self, obj):
        return self.context.get("ai_remaining_today")

    def get_ai_daily_limit(self, obj):
        return self.context.get("ai_daily_limit")

    def get_can_generate_draft(self, obj):
        title_or_summary = bool((obj.title or "").strip() or (obj.issue_summary or "").strip())
        note_or_image = bool((obj.notes or "").strip() or obj.images.exists())
        return title_or_summary and note_or_image


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

    def validate_text(self, value):
        text = str(value or "").strip()
        if not text:
            raise serializers.ValidationError("Comment cannot be empty.")
        if len(text) > COMMENT_CHAR_LIMIT:
            raise serializers.ValidationError(f"Comments must be {COMMENT_CHAR_LIMIT} characters or fewer.")
        if URL_PATTERN.search(text):
            raise serializers.ValidationError("Public comments cannot include links.")
        return text


class ProjectSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    images = ProjectImageSerializer(many=True, read_only=True)

    cover_image_url = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    viewer_is_invited = serializers.SerializerMethodField()
    invited_contractors = serializers.SerializerMethodField()
    private_contractor_usernames = serializers.JSONField(write_only=True, required=False)
    bid_count = serializers.IntegerField(read_only=True, default=0)
    accepted_bid_count = serializers.IntegerField(read_only=True, default=0)
    like_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    saved_by_me = serializers.SerializerMethodField()

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
            "is_private",
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
            "private_contractor_usernames",
            "invited_contractors",
            "notify_by_email",
            "job_is_published",
            "viewer_is_invited",
            "bid_count",
            "accepted_bid_count",
            "like_count",
            "liked_by_me",
            "saved_by_me",
            "cover_image_ref",
            "cover_image_file",
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
            "invited_contractors",
        ]

    def _normalize_invite_usernames(self, value):
        if value in (None, ""):
            return []
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                value = parsed
            except (TypeError, ValueError):
                value = [value]
        if not isinstance(value, list):
            raise serializers.ValidationError("Invited contractors must be a list.")

        cleaned = []
        seen = set()
        for item in value:
            username = str(item or "").strip()
            key = username.lower()
            if username and key not in seen:
                cleaned.append(username)
                seen.add(key)
        return cleaned

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
        instance = getattr(self, "instance", None)
        is_public = attrs.get(
            "is_public",
            getattr(instance, "is_public", True) if instance else True,
        )
        compliance_confirmed = attrs.get(
            "compliance_confirmed",
            getattr(instance, "compliance_confirmed", False) if instance else False,
        )
        is_job_posting = attrs.get(
            "is_job_posting",
            getattr(instance, "is_job_posting", False) if instance else False,
        )

        if is_public and not compliance_confirmed:
            raise serializers.ValidationError(
                {"compliance_confirmed": "Please confirm compliance before publishing."}
            )

        if is_job_posting:
            post_privacy = attrs.get(
                "post_privacy",
                getattr(instance, "post_privacy", "public") if instance else "public",
            )
            is_private = attrs.get(
                "is_private",
                getattr(instance, "is_private", False) if instance else False,
            )
            if post_privacy == "private" or is_private:
                attrs["is_private"] = True
                attrs["post_privacy"] = "private"
                invite_usernames = self._normalize_invite_usernames(
                    attrs.get("private_contractor_usernames", None)
                )
                legacy_username = (
                    attrs.get(
                        "private_contractor_username",
                        getattr(instance, "private_contractor_username", "") if instance else "",
                    )
                    or ""
                ).strip()
                if not invite_usernames and legacy_username:
                    invite_usernames = [legacy_username]

                if not invite_usernames:
                    raise serializers.ValidationError(
                        {"private_contractor_usernames": "Private jobs require at least one invited contractor."}
                    )
                if len(invite_usernames) > 6:
                    raise serializers.ValidationError(
                        {"private_contractor_usernames": "Invite up to 6 contractors per private job."}
                    )
                request = self.context.get("request")
                owner = getattr(instance, "owner", None) or getattr(request, "user", None)
                contractors = list(
                    User.objects
                    .filter(
                        username__in=invite_usernames,
                        is_active=True,
                        profile__profile_type="contractor",
                        profile__is_frozen=False,
                        profile__is_deactivated=False,
                    )
                    .select_related("profile")
                )
                found = {user.username.lower(): user for user in contractors}
                missing = [username for username in invite_usernames if username.lower() not in found]
                if missing:
                    raise serializers.ValidationError(
                        {"private_contractor_usernames": f"No active contractor found for: {', '.join(missing)}."}
                    )
                if owner and any(user.id == owner.id for user in contractors):
                    raise serializers.ValidationError(
                        {"private_contractor_usernames": "You cannot invite yourself to your own job."}
                    )
                attrs["private_contractor_usernames"] = [found[username.lower()].username for username in invite_usernames]
                attrs["private_contractor_username"] = attrs["private_contractor_usernames"][0]
                attrs["is_public"] = False
            else:
                attrs["is_private"] = False
                attrs["post_privacy"] = "public"
                attrs["private_contractor_username"] = ""
                attrs["private_contractor_usernames"] = []

            incoming_job_summary = attrs.get("job_summary", None)
            incoming_summary = attrs.get("summary", None)

            if (incoming_job_summary is None or str(incoming_job_summary).strip() == "") and (
                incoming_summary is not None and str(incoming_summary).strip() != ""
            ):
                attrs["job_summary"] = incoming_summary

            if "service_categories" in attrs and attrs["service_categories"] is None:
                attrs["service_categories"] = []

        return attrs

    def get_cover_image_url(self, obj):
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

    def get_viewer_is_invited(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return obj.invites.filter(
            contractor=user,
            status__in=[ProjectInvite.STATUS_INVITED, ProjectInvite.STATUS_ACCEPTED],
        ).exists()

    def get_invited_contractors(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return []
        if obj.owner_id != user.id and not getattr(user, "is_staff", False):
            return []
        return [
            {
                "username": invite.contractor.username,
                "display_name": getattr(invite.contractor.profile, "display_name", "") or invite.contractor.username,
                "status": invite.status,
                "created_at": invite.created_at,
            }
            for invite in obj.invites.select_related("contractor", "contractor__profile").order_by("contractor__username")
        ]

    def get_like_count(self, obj):
        return ProjectLike.objects.filter(project=obj).count()

    def get_liked_by_me(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return ProjectLike.objects.filter(project=obj, user=user).exists()

    def get_saved_by_me(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        return ProjectFavorite.objects.filter(project=obj, user=user).exists()

    def _sync_project_invites(self, project, invite_usernames=None):
        if not project.is_job_posting or not project.is_private:
            ProjectInvite.objects.filter(project=project).delete()
            return

        usernames = self._normalize_invite_usernames(invite_usernames)
        if not usernames:
            username = (project.private_contractor_username or "").strip()
            usernames = [username] if username else []

        if not usernames:
            ProjectInvite.objects.filter(project=project).delete()
            return

        contractors = list(User.objects.filter(username__in=usernames))
        if not contractors:
            ProjectInvite.objects.filter(project=project).delete()
            return

        for contractor in contractors:
            ProjectInvite.objects.update_or_create(
                project=project,
                contractor=contractor,
                defaults={"status": ProjectInvite.STATUS_INVITED},
            )
        ProjectInvite.objects.filter(project=project).exclude(contractor__in=contractors).delete()

    def create(self, validated_data):
        invite_usernames = validated_data.pop("private_contractor_usernames", None)
        project = super().create(validated_data)
        self._sync_project_invites(project, invite_usernames)
        return project

    def update(self, instance, validated_data):
        invite_usernames = validated_data.pop("private_contractor_usernames", None)
        project = super().update(instance, validated_data)
        self._sync_project_invites(project, invite_usernames)
        return project


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


class ProjectLikeSerializer(ProjectFavoriteSerializer):
    class Meta(ProjectFavoriteSerializer.Meta):
        model = ProjectLike


class MessageAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = MessageAttachment
        fields = [
            "id",
            "kind",
            "name",
            "original_name",
            "url",
            "file_url",
            "created_at",
            "can_delete",
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and hasattr(obj.file, "url"):
            url = obj.file.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_name(self, obj):
        return obj.original_name or (obj.file.name.split("/")[-1] if obj.file else "")

    def get_can_delete(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if obj.message.sender_id != user.id:
            return False

        return timezone.now() <= obj.message.created_at + timedelta(minutes=1)


class PrivateMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.ReadOnlyField(source="sender.username")
    attachment_url = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()
    context_project_title = serializers.ReadOnlyField(source="context_project.title")

    parent_message_id = serializers.PrimaryKeyRelatedField(
        source="parent_message",
        queryset=PrivateMessage.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    parent_message_preview = serializers.SerializerMethodField()
    attachments = MessageAttachmentSerializer(many=True, read_only=True)

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
            "parent_message_id",
            "parent_message_preview",
            "context_project",
            "context_project_title",
            "created_at",
            "attachments",
            "can_delete",
        ]
        read_only_fields = [
            "id",
            "sender",
            "thread",
            "sender_username",
            "attachment_url",
            "parent_message_preview",
            "context_project",
            "context_project_title",
            "created_at",
            "attachments",
            "can_delete",
        ]

    def get_attachment_url(self, obj):
        request = self.context.get("request")
        if obj.attachment and hasattr(obj.attachment, "url"):
            url = obj.attachment.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_parent_message_preview(self, obj):
        parent = getattr(obj, "parent_message", None)
        if not parent:
            return None
        return {
            "id": parent.id,
            "sender_username": getattr(parent.sender, "username", ""),
            "text": parent.text or "",
            "created_at": parent.created_at,
        }

    def validate(self, attrs):
        thread = attrs.get("thread") or getattr(self.instance, "thread", None)
        parent = attrs.get("parent_message") or getattr(self.instance, "parent_message", None)

        if parent and thread and parent.thread_id != thread.id:
            raise serializers.ValidationError(
                {"parent_message_id": "Parent message must belong to the same thread."}
            )

        return attrs

    def get_can_delete(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if obj.sender_id != user.id:
            return False

        return timezone.now() <= obj.created_at + timedelta(minutes=1)


class MessageThreadSerializer(serializers.ModelSerializer):
    project_title = serializers.ReadOnlyField(source="project.title")
    owner_username = serializers.ReadOnlyField(source="owner.username")
    client_username = serializers.ReadOnlyField(source="client.username")

    latest_message = serializers.SerializerMethodField()
    owner_profile = ProfileSerializer(source="owner.profile", read_only=True)
    client_profile = ProfileSerializer(source="client.profile", read_only=True)

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
        latest_id = getattr(obj, "latest_message_id", None)
        if latest_id is None:
            msg = obj.messages.order_by("-created_at").first()
            if not msg:
                return None
            return {
                "id": msg.id,
                "sender_username": getattr(msg.sender, "username", ""),
                "text": msg.text or "",
                "attachment_name": msg.attachment_name or "",
                "created_at": msg.created_at,
            }

        return {
            "id": latest_id,
            "sender_username": getattr(obj, "latest_message_sender_username", "") or "",
            "text": getattr(obj, "latest_message_text", "") or "",
            "attachment_name": getattr(obj, "latest_message_attachment_name", "") or "",
            "created_at": getattr(obj, "latest_message_created_at", None),
        }

    def _current_user(self):
        request = self.context.get("request")
        u = getattr(request, "user", None)
        return u if u and u.is_authenticated else None

    def get_is_request(self, obj):
        user = self._current_user()
        if not user:
            return False
        return not bool(obj.user_has_accepted(user))

    def get_can_reply(self, obj):
        user = self._current_user()
        if not user:
            return False
        if not obj.user_is_participant(user):
            return False
        if obj.is_blocked_for(user):
            return False
        if not obj.user_has_accepted(user):
            return False

        other = obj.client if user.id == obj.owner_id else obj.owner
        ignored_until = obj.ignored_until_for(other)
        if (not obj.user_has_accepted(other)) and ignored_until and timezone.now() < ignored_until:
            return False

        return True

    def get_ignored_until(self, obj):
        user = self._current_user()
        if not user or not obj.user_is_participant(user):
            return None

        other = obj.client if user.id == obj.owner_id else obj.owner
        return obj.ignored_until_for(other)

    def get_blocked(self, obj):
        user = self._current_user()
        if not user:
            return False
        return bool(obj.is_blocked_for(user))


# -------------------------------------------------------------------
# Project bids
# -------------------------------------------------------------------
class ProjectBidVersionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectBidVersion
        fields = [
            "id",
            "bid",
            "version_number",
            "price_type",
            "amount",
            "amount_min",
            "amount_max",
            "timeline_text",
            "proposal_text",
            "included_text",
            "excluded_text",
            "payment_terms",
            "valid_until",
            "attachment",
            "attachment_url",
            "created_by",
            "created_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "bid",
            "version_number",
            "attachment_url",
            "created_by",
            "created_by_username",
            "created_at",
        ]

    def get_attachment_url(self, obj):
        request = self.context.get("request")
        if obj.attachment and hasattr(obj.attachment, "url"):
            url = obj.attachment.url
            return request.build_absolute_uri(url) if request else url
        return None

    def validate(self, attrs):
        price_type = attrs.get("price_type", getattr(self.instance, "price_type", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        amount_min = attrs.get("amount_min", getattr(self.instance, "amount_min", None))
        amount_max = attrs.get("amount_max", getattr(self.instance, "amount_max", None))

        if price_type == ProjectBidVersion.PRICE_TYPE_FIXED:
            if amount is None:
                raise serializers.ValidationError(
                    {"amount": "Amount is required for a fixed-price bid."}
                )
            if amount_min is not None or amount_max is not None:
                raise serializers.ValidationError(
                    {"price_type": "Use amount only for a fixed-price bid."}
                )

        elif price_type == ProjectBidVersion.PRICE_TYPE_RANGE:
            if amount_min is None or amount_max is None:
                raise serializers.ValidationError(
                    {"price_type": "Amount min and amount max are required for a range bid."}
                )
            if amount is not None:
                raise serializers.ValidationError(
                    {"price_type": "Use amount min/max only for a range bid."}
                )
            if amount_min > amount_max:
                raise serializers.ValidationError(
                    {"amount_max": "Amount max must be greater than or equal to amount min."}
                )

        return attrs


class ProjectBidSerializer(serializers.ModelSerializer):
    contractor_username = serializers.CharField(source="contractor.username", read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    latest_version = serializers.SerializerMethodField()
    accepted_version_id = serializers.IntegerField(source="accepted_version.id", read_only=True)
    is_owner = serializers.SerializerMethodField()
    is_contractor = serializers.SerializerMethodField()

    class Meta:
        model = ProjectBid
        fields = [
            "id",
            "project",
            "project_title",
            "contractor",
            "contractor_username",
            "status",
            "accepted_version",
            "accepted_version_id",
            "latest_version",
            "is_owner",
            "is_contractor",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "project",
            "project_title",
            "contractor",
            "contractor_username",
            "accepted_version",
            "accepted_version_id",
            "latest_version",
            "is_owner",
            "is_contractor",
            "created_at",
            "updated_at",
        ]

    def get_latest_version(self, obj):
        latest = obj.latest_version
        if not latest:
            return None
        return ProjectBidVersionSerializer(latest, context=self.context).data

    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(
            request and request.user.is_authenticated and obj.project.owner_id == request.user.id
        )

    def get_is_contractor(self, obj):
        request = self.context.get("request")
        return bool(
            request and request.user.is_authenticated and obj.contractor_id == request.user.id
        )

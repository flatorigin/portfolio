# file: backend/portfolio/views.py
import json
import logging
import re

from django.conf import settings
from django.core.files.storage import default_storage
from django.db import models, transaction
from django.db.models import Count, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.ai import AIServiceError, generate_text
from accounts.geo_distance import get_request_origin, sort_by_distance
from accounts.models import (
    AIConfiguration,
    AIUsageEvent,
    Profile,
    get_ai_remaining_today_for_user,
)
from .models import (
    Project,
    ProjectImage,
    ProjectPlan,
    ProjectPlanImage,
    ProjectComment,
    ProjectInvite,
    MessageThread,
    PrivateMessage,
    ProjectFavorite,
    ProjectLike,
    MessageAttachment,
    ProjectBid,
    ProjectBidVersion,
)
from apps.bids.models import Bid
from .access import can_access_job_interactions, can_view_project, visible_projects_q_for_user
from .serializers import (
    ProjectSerializer,
    ProjectImageSerializer,
    ProjectPlanSerializer,
    ProjectPlanImageSerializer,
    ProjectCommentSerializer,
    MessageThreadSerializer,
    PrivateMessageSerializer,
    ProjectFavoriteSerializer,
    ProjectLikeSerializer,
    ProjectBidSerializer,
    ProjectBidVersionSerializer,
)
from .permissions import IsOwnerOrReadOnly, IsCommentAuthorOrReadOnly
from .project_intake import (
    calculate_project_readiness_score,
    get_project_intake_template,
    get_project_type_choices,
    iter_answer_lines,
    load_project_intake_templates,
    summarize_markup_notes,
)

logger = logging.getLogger(__name__)
SUPPORTED_PROJECT_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "video/mp4",
    "video/quicktime",
    "video/webm",
}
SUPPORTED_PROJECT_IMAGE_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
    ".mp4",
    ".mov",
    ".webm",
)

VIDEO_UPLOAD_CONTENT_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
VIDEO_UPLOAD_EXTENSIONS = (".mp4", ".mov", ".webm")

User = get_user_model()


def require_contractor_user(user):
    profile = getattr(user, "profile", None)
    if getattr(profile, "profile_type", "") != "contractor":
        raise PermissionDenied("Only contractor accounts can submit or manage bids.")


def require_homeowner_user(user):
    profile = getattr(user, "profile", None)
    if getattr(profile, "profile_type", "") != "homeowner":
        raise PermissionDenied("Only homeowner accounts can create project drafts from chat.")


def suggest_project_title_from_message(text):
    cleaned = re.sub(r"\s+", " ", str(text or "").strip())
    if not cleaned:
        return "New project draft"

    first_chunk = re.split(r"[.!?\n]", cleaned, maxsplit=1)[0].strip(" -,:;")
    candidate = first_chunk or cleaned
    if len(candidate) > 72:
        candidate = candidate[:69].rstrip() + "..."
    return candidate or "New project draft"


def require_homeowner_profile(user):
    profile = getattr(user, "profile", None)
    if getattr(profile, "profile_type", "") != Profile.ProfileType.HOMEOWNER:
        raise PermissionDenied("Only homeowner accounts can use the project planner.")
    return profile


def get_ai_config():
    config = AIConfiguration.get_solo()
    if not config.daily_limit_per_user:
        config.daily_limit_per_user = 10
    return config


def get_ai_remaining_today(user):
    config = get_ai_config()
    return get_ai_remaining_today_for_user(user, config=config)


def ensure_planner_ai_allowed(user, feature):
    config = get_ai_config()
    if not settings.AI_ENABLED and not config.enabled:
        raise PermissionDenied("AI helpers are currently paused.")
    if not config.project_helper_enabled:
        raise PermissionDenied("AI helpers are currently paused.")
    remaining, daily_limit = get_ai_remaining_today(user)
    if remaining <= 0:
        raise ValidationError(
            {
                "detail": "You’ve used all 10 AI assists. You can still fill this out manually.",
                "remaining_today": 0,
                "daily_limit": daily_limit,
            }
        )
    return config, remaining, daily_limit, feature


def parse_ai_json(text):
    cleaned = str(text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


# ---------------------------------------------------
# Comments: list + create
#   GET  /api/projects/<pk>/comments/
#   POST /api/projects/<pk>/comments/
# ---------------------------------------------------
class ProjectCommentListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectCommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_project(self):
        project = get_object_or_404(Project.objects.select_related("owner").prefetch_related("invites"), pk=self.kwargs["pk"])
        if not can_view_project(project, self.request.user):
            raise PermissionDenied("You do not have access to this project.")
        return project

    def get_queryset(self):
        project = self.get_project()
        return ProjectComment.objects.filter(project_id=project.id).order_by("-created_at")

    def perform_create(self, serializer):
        project = self.get_project()
        serializer.save(project=project, author=self.request.user)


class ProjectCommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectCommentSerializer
    permission_classes = [
        permissions.IsAuthenticatedOrReadOnly,
        IsCommentAuthorOrReadOnly,
    ]
    lookup_field = "id"
    lookup_url_kwarg = "comment_id"

    def get_queryset(self):
        project = get_object_or_404(Project.objects.select_related("owner").prefetch_related("invites"), pk=self.kwargs["pk"])
        if not can_view_project(project, self.request.user):
            raise PermissionDenied("You do not have access to this project.")
        return ProjectComment.objects.filter(project_id=project.id)

    def perform_update(self, serializer):
        obj = self.get_object()
        if getattr(obj, "testimonial_published", False):
            raise PermissionDenied("This comment is published as a testimonial and cannot be edited.")
        serializer.save()

    def perform_destroy(self, instance):
        if getattr(instance, "testimonial_published", False):
            raise PermissionDenied("This comment is published as a testimonial and cannot be deleted.")
        instance.delete()


class PublishTestimonialView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, comment_id):
        project = get_object_or_404(Project, pk=pk)

        if project.owner_id != request.user.id:
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        comment = get_object_or_404(ProjectComment, id=comment_id, project_id=project.id)
        comment.is_testimonial = True
        comment.testimonial_published = True
        comment.testimonial_published_at = timezone.now()
        comment.save(update_fields=["is_testimonial", "testimonial_published", "testimonial_published_at"])

        ser = ProjectCommentSerializer(comment, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class UnpublishTestimonialView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, comment_id):
        project = get_object_or_404(Project, pk=pk)

        if project.owner_id != request.user.id:
            return Response({"detail": "Not allowed."}, status=status.HTTP_403_FORBIDDEN)

        comment = get_object_or_404(ProjectComment, id=comment_id, project_id=project.id)
        comment.testimonial_published = False
        comment.testimonial_published_at = None
        comment.save(update_fields=["testimonial_published", "testimonial_published_at"])

        ser = ProjectCommentSerializer(comment, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


# ---------------------------------------------------
# Projects + images + favorites
# ---------------------------------------------------
class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related("owner").prefetch_related("invites").annotate(
        bid_count=Count("bids", distinct=True),
        accepted_bid_count=Count(
            "bids",
            filter=Q(bids__status=Bid.STATUS_ACCEPTED),
            distinct=True,
        ),
    ).all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated], url_path="mine")
    def mine(self, request):
        qs = (
            Project.objects.select_related("owner").prefetch_related("invites")
            .annotate(
                bid_count=Count("bids", distinct=True),
                accepted_bid_count=Count(
                    "bids",
                    filter=Q(bids__status=Bid.STATUS_ACCEPTED),
                    distinct=True,
                ),
            )
            .filter(owner=request.user)
            .order_by("-updated_at")
        )
        ser = self.get_serializer(qs, many=True, context={"request": request})
        return Response(ser.data)

    def get_queryset(self):
        qs = (
            Project.objects.select_related("owner").prefetch_related("invites")
            .annotate(
                bid_count=Count("bids", distinct=True),
                accepted_bid_count=Count(
                    "bids",
                    filter=Q(bids__status=Bid.STATUS_ACCEPTED),
                    distinct=True,
                ),
            )
            .all()
        )
        request = self.request
        owner_username = (request.query_params.get("owner") or "").strip()

        if owner_username:
            qs = qs.filter(owner__username=owner_username)

        return qs.filter(visible_projects_q_for_user(request.user)).distinct()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        serializer.save(owner=self.request.user)

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        if project.owner != request.user:
            raise PermissionDenied("You do not have permission to delete this project.")

        with transaction.atomic():
            imgs = ProjectImage.objects.filter(project=project)
            for img in imgs:
                try:
                    if img.image:
                        img.image.delete(save=False)
                except Exception:
                    pass
            imgs.delete()

            ProjectComment.objects.filter(project=project).delete()
            ProjectFavorite.objects.filter(project=project).delete()
            ProjectLike.objects.filter(project=project).delete()

            MessageThread.objects.filter(project=project).delete()
            ProjectBid.objects.filter(project=project).delete()
            Bid.objects.filter(project=project).delete()

            project.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @action(detail=True, methods=["get", "post"], url_path="images")
    def images(self, request, pk=None):
        project = self.get_object()

        if request.method.lower() == "get":
            qs = list(project.images.order_by("order", "id"))
            existing = []
            missing = []
            for img in qs:
                name = getattr(img.image, "name", "")
                if name and default_storage.exists(name):
                    existing.append(img)
                else:
                    missing.append(img.id)
            if missing:
                logger.warning(
                    "Project image list skipped missing files for project_id=%s image_ids=%s",
                    project.id,
                    missing,
                )
            ser = ProjectImageSerializer(existing, many=True, context={"request": request})
            return Response(ser.data)

        if project.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        files = request.FILES.getlist("images")
        captions = request.data.getlist("captions[]") or request.data.getlist("captions") or []

        if not files:
            logger.warning(
                "Project image upload received no files for project_id=%s user_id=%s content_type=%s",
                project.id,
                request.user.id,
                request.content_type,
            )
            return Response(
                {"detail": "No image files were received. Choose one or more image files and try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unsupported = [
            getattr(f, "name", "Selected file")
            for f in files
            if getattr(f, "content_type", "") not in SUPPORTED_PROJECT_IMAGE_CONTENT_TYPES
            and not str(getattr(f, "name", "")).lower().endswith(SUPPORTED_PROJECT_IMAGE_EXTENSIONS)
        ]
        if unsupported:
            return Response(
                {
                    "detail": (
                        "Unsupported image format: "
                        + ", ".join(unsupported)
                        + ". Please use JPG, PNG, WebP, MP4, MOV, or WebM."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = []
        base_order = project.images.count()
        try:
            for idx, f in enumerate(files):
                caption = captions[idx] if idx < len(captions) else ""
                content_type = str(getattr(f, "content_type", "") or "").lower()
                file_name = str(getattr(f, "name", "") or "").lower()
                media_type = (
                    ProjectImage.MEDIA_TYPE_VIDEO
                    if content_type in VIDEO_UPLOAD_CONTENT_TYPES
                    or file_name.endswith(VIDEO_UPLOAD_EXTENSIONS)
                    else ProjectImage.MEDIA_TYPE_IMAGE
                )
                img = ProjectImage.objects.create(
                    project=project,
                    image=f,
                    media_type=media_type,
                    caption=caption,
                    order=base_order + idx,
                )
                created.append(img)
        except Exception as exc:
            logger.exception(
                "Project image upload failed for project_id=%s user_id=%s file_count=%s",
                project.id,
                request.user.id,
                len(files),
            )
            detail = "Could not upload media. Try a JPG, PNG, WebP, MP4, MOV, or WebM file."
            if settings.DEBUG:
                detail = f"{detail} ({exc})"
            return Response({"detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        ser = ProjectImageSerializer(created, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path="images/(?P<img_id>[^/.]+)")
    def image_detail(self, request, pk=None, img_id=None):
        project = self.get_object()
        try:
            img = ProjectImage.objects.get(id=img_id, project=project)
        except ProjectImage.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if project.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == "delete":
            img.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        cover_keys = ("is_cover", "is_cover_image", "is_cover_photo")
        wants_cover_flag = any(
            str(request.data.get(k, "")).lower() in ("1", "true", "yes", "on")
            for k in cover_keys
        )

        data = request.data.copy()
        for k in cover_keys:
            if k in data:
                data.pop(k)

        ser = ProjectImageSerializer(
            img,
            data=data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)

        new_order = ser.validated_data.get("order", None)

        if wants_cover_flag or new_order == 0:
            if img.media_type != ProjectImage.MEDIA_TYPE_IMAGE:
                return Response(
                    {"detail": "Only image media can be used as the project cover."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            with transaction.atomic():
                ProjectImage.objects.filter(project=project).exclude(id=img.id).update(
                    order=models.F("order") + 1
                )
                ser.save(order=0)

            with transaction.atomic():
                qs = list(ProjectImage.objects.filter(project=project).order_by("order", "id"))
                for idx, row in enumerate(qs):
                    if row.order != idx:
                        row.order = idx
                ProjectImage.objects.bulk_update(qs, ["order"])

            updated = ProjectImage.objects.get(id=img.id)
            return Response(
                ProjectImageSerializer(updated, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        ser.save()
        return Response(ser.data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        permission_classes=[IsAuthenticated],
        url_path="favorite",
    )
    def favorite(self, request, pk=None):
        project = self.get_object()
        user = request.user

        if project.owner_id == user.id:
            return Response(
                {"detail": "You cannot save your own project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = ProjectFavorite.objects.filter(user=user, project=project)

        if request.method == "GET":
            return Response({"is_favorited": qs.exists()}, status=status.HTTP_200_OK)

        if request.method == "POST":
            ProjectFavorite.objects.get_or_create(user=user, project=project)
            return Response({"is_favorited": True}, status=status.HTTP_200_OK)

        qs.delete()
        return Response({"is_favorited": False}, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        permission_classes=[IsAuthenticated],
        url_path="like",
    )
    def like(self, request, pk=None):
        project = self.get_object()
        user = request.user

        if project.owner_id == user.id:
            return Response(
                {"detail": "You cannot like your own project."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = ProjectLike.objects.filter(user=user, project=project)

        if request.method == "GET":
            return Response(
                {
                    "liked": qs.exists(),
                    "like_count": ProjectLike.objects.filter(project=project).count(),
                },
                status=status.HTTP_200_OK,
            )

        if request.method == "POST":
            ProjectLike.objects.get_or_create(user=user, project=project)
            return Response(
                {"liked": True, "like_count": ProjectLike.objects.filter(project=project).count()},
                status=status.HTTP_200_OK,
            )

        qs.delete()
        return Response(
            {"liked": False, "like_count": ProjectLike.objects.filter(project=project).count()},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="job-postings",
        permission_classes=[permissions.AllowAny],
    )
    def job_postings(self, request):
        qs = (
            Project.objects.select_related("owner")
            .filter(
                is_job_posting=True,
                is_public=True,
                is_private=False,
                post_privacy="public",
            )
            .order_by("-updated_at")
        )
        origin = get_request_origin(request)
        distance_lookup = {}
        if origin:
            projects = list(qs.select_related("owner__profile"))
            fallback_order = {project.pk: index for index, project in enumerate(projects)}
            projects, distance_lookup = sort_by_distance(
                projects,
                origin,
                lambda project: getattr(getattr(project.owner, "profile", None), "service_lat", None),
                lambda project: getattr(getattr(project.owner, "profile", None), "service_lng", None),
                lambda project: fallback_order.get(project.pk, 0),
            )
            qs = projects
        ser = self.get_serializer(
            qs,
            many=True,
            context={"request": request, "distance_lookup": distance_lookup},
        )
        return Response(ser.data)


class ProjectPlanViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectPlanSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        require_homeowner_profile(self.request.user)
        qs = ProjectPlan.objects.filter(owner=self.request.user).prefetch_related("images")
        scope = (self.request.query_params.get("scope") or "").strip().lower()
        if scope == "active":
            qs = qs.filter(
                status__in=[
                    ProjectPlan.STATUS_PLANNING,
                    ProjectPlan.STATUS_READY_TO_DRAFT,
                    ProjectPlan.STATUS_ARCHIVED,
                ]
            )
        elif scope == "inactive":
            qs = qs.filter(
                status__in=[ProjectPlan.STATUS_CONVERTED]
            )
        return qs.order_by("-updated_at", "-id")

    def _serializer_context(self):
        remaining, daily_limit = get_ai_remaining_today(self.request.user)
        active_plan_count = ProjectPlan.objects.filter(
            owner=self.request.user,
            status__in=[
                ProjectPlan.STATUS_PLANNING,
                ProjectPlan.STATUS_READY_TO_DRAFT,
                ProjectPlan.STATUS_ARCHIVED,
            ],
        ).count()
        return {
            "request": self.request,
            "active_plan_count": active_plan_count,
            "ai_remaining_today": remaining,
            "ai_daily_limit": daily_limit,
        }

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx.update(self._serializer_context())
        return ctx

    def _sync_plan_derived_fields(self, plan, *, save=True):
        template = get_project_intake_template(plan.project_type)
        guided_answers = dict(plan.guided_answers_json or {})
        if template:
            for question in template.get("questions") or []:
                if question.get("maps_to_field") == "site_access":
                    value = guided_answers.get(question.get("id"))
                    if isinstance(value, list):
                        value = ", ".join([str(item or "").strip() for item in value if str(item or "").strip()])
                    value = str(value or "").strip()
                    if value:
                        plan.site_access = value[:255]
                    break
            total_questions = len(template.get("questions") or [])
            if total_questions:
                plan.guided_question_index = min(max(int(plan.guided_question_index or 0), 0), total_questions)

        plan.project_readiness_score = calculate_project_readiness_score(plan, template=template, guided_answers=guided_answers)
        if save:
            plan.save(
                update_fields=[
                    "site_access",
                    "guided_question_index",
                    "project_readiness_score",
                    "updated_at",
                ]
            )
        return plan

    def perform_create(self, serializer):
        require_homeowner_profile(self.request.user)
        plan = serializer.save(
            owner=self.request.user,
            title=(serializer.validated_data.get("title") or "Untitled issue").strip() or "Untitled issue",
            visibility="private",
            status=serializer.validated_data.get("status") or ProjectPlan.STATUS_PLANNING,
        )
        self._sync_plan_derived_fields(plan)

    def perform_update(self, serializer):
        plan = serializer.save(owner=self.request.user, visibility="private")
        self._sync_plan_derived_fields(plan)

    @action(detail=False, methods=["get"], url_path="meta")
    def meta(self, request):
        require_homeowner_profile(request.user)
        remaining, daily_limit = get_ai_remaining_today(request.user)
        active_count = ProjectPlan.objects.filter(
            owner=request.user,
            status__in=[
                ProjectPlan.STATUS_PLANNING,
                ProjectPlan.STATUS_READY_TO_DRAFT,
                ProjectPlan.STATUS_ARCHIVED,
            ],
        ).count()
        return Response(
            {
                "active_count": active_count,
                "max_active_plans": 3,
                "ai_remaining_today": remaining,
                "ai_daily_limit": daily_limit,
                "can_create": active_count < 3,
                "project_type_choices": get_project_type_choices(),
                "project_intake_templates": load_project_intake_templates().get("project_types", []),
            }
        )

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        plan = self.get_object()
        plan.status = ProjectPlan.STATUS_ARCHIVED
        plan.save(update_fields=["status", "updated_at"])
        return Response(
            ProjectPlanSerializer(plan, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="unarchive")
    def unarchive(self, request, pk=None):
        plan = self.get_object()
        plan.status = ProjectPlan.STATUS_PLANNING
        plan.save(update_fields=["status", "updated_at"])
        return Response(
            ProjectPlanSerializer(plan, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "post"], url_path="images")
    def images(self, request, pk=None):
        plan = self.get_object()
        if request.method.lower() == "get":
            qs = plan.images.order_by("order", "id")
            return Response(ProjectPlanImageSerializer(qs, many=True, context={"request": request}).data)

        files = request.FILES.getlist("images")
        captions = request.data.getlist("captions[]") or request.data.getlist("captions") or []
        created = []
        base_order = plan.images.count()
        for idx, image_file in enumerate(files):
            caption = captions[idx] if idx < len(captions) else ""
            created.append(
                ProjectPlanImage.objects.create(
                    project_plan=plan,
                    image=image_file,
                    caption=caption,
                    order=base_order + idx,
                    is_cover=(base_order + idx == 0 and not plan.images.filter(is_cover=True).exists()),
                )
            )
        self._sync_plan_derived_fields(plan)
        return Response(
            ProjectPlanImageSerializer(created, many=True, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch", "delete"], url_path="images/(?P<img_id>[^/.]+)")
    def image_detail(self, request, pk=None, img_id=None):
        plan = self.get_object()
        try:
            image = ProjectPlanImage.objects.get(id=img_id, project_plan=plan)
        except ProjectPlanImage.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.method.lower() == "delete":
            image.delete()
            if not plan.images.filter(is_cover=True).exists():
                replacement = plan.images.order_by("order", "id").first()
                if replacement:
                    replacement.is_cover = True
                    replacement.order = 0
                    replacement.save(update_fields=["is_cover", "order"])
            self._sync_plan_derived_fields(plan)
            return Response(status=status.HTTP_204_NO_CONTENT)

        ser = ProjectPlanImageSerializer(
            image,
            data=request.data.copy(),
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        wants_cover = str(request.data.get("is_cover", "")).lower() in ("1", "true", "yes", "on")
        with transaction.atomic():
            if wants_cover:
                ProjectPlanImage.objects.filter(project_plan=plan).update(is_cover=False)
                ser.save(is_cover=True, order=0)
                siblings = list(
                    ProjectPlanImage.objects.filter(project_plan=plan).exclude(id=image.id).order_by("order", "id")
                )
                for idx, sibling in enumerate(siblings, start=1):
                    if sibling.order != idx:
                        sibling.order = idx
                if siblings:
                    ProjectPlanImage.objects.bulk_update(siblings, ["order"])
            else:
                ser.save()
        image.refresh_from_db()
        self._sync_plan_derived_fields(plan)
        return Response(ProjectPlanImageSerializer(image, context={"request": request}).data)

    def _build_plan_text(self, plan):
        image_bits = []
        for image in plan.images.order_by("order", "id")[:6]:
            image_bits.append(f"- Image {image.id}: caption={image.caption or 'none'}")
        template = get_project_intake_template(plan.project_type)
        guided_lines = list(iter_answer_lines(template, plan.guided_answers_json or {}))
        markup_lines = summarize_markup_notes(plan.markup_data or {})
        return "\n".join(
            [
                f"Title: {plan.title}",
                f"Project type: {plan.project_type}",
                f"Issue summary: {plan.issue_summary}",
                f"House location: {plan.house_location}",
                f"Priority: {plan.priority}",
                f"Budget min: {plan.budget_min or ''}",
                f"Budget max: {plan.budget_max or ''}",
                f"Site access: {plan.site_access or ''}",
                f"Notes: {plan.notes}",
                f"Guided answers: {' | '.join(guided_lines) if guided_lines else 'none'}",
                f"Contractor types: {', '.join(plan.contractor_types or [])}",
                f"Links: {json.dumps(plan.links or [])}",
                f"Options: {json.dumps(plan.options or [])}",
                f"Selected option key: {plan.selected_option_key}",
                f"Markup notes: {' | '.join(markup_lines) if markup_lines else 'none'}",
                "Images:",
                "\n".join(image_bits) or "- none",
            ]
        )

    def _record_ai_event(self, *, user, feature, model_name, prompt_chars, response_chars, status_value):
        AIUsageEvent.objects.create(
            user=user,
            feature=feature,
            model_name=model_name,
            status=status_value,
            prompt_chars=prompt_chars,
            response_chars=response_chars,
        )

    @action(detail=True, methods=["post"], url_path="ai")
    def ai(self, request, pk=None):
        plan = self.get_object()
        action_name = str(request.data.get("action") or "").strip()
        if action_name not in ("analyze_issue", "suggest_solution_paths", "generate_contractor_ready_project"):
            raise ValidationError({"action": "Unsupported planner AI action."})

        feature = {
            "analyze_issue": AIUsageEvent.Feature.PLANNER_ANALYZE,
            "suggest_solution_paths": AIUsageEvent.Feature.PLANNER_OPTIONS,
            "generate_contractor_ready_project": AIUsageEvent.Feature.PLANNER_DRAFT,
        }[action_name]
        _, _, daily_limit, _ = ensure_planner_ai_allowed(request.user, feature)

        if action_name == "analyze_issue":
            system_prompt = (
                "You are helping a homeowner understand a house issue before posting work. "
                "Return strict JSON with keys: likely_issue_label, explanation, contractor_types, next_steps. "
                "Keep it practical, short, and non-alarmist. contractor_types and next_steps must be arrays of strings."
            )
        elif action_name == "suggest_solution_paths":
            system_prompt = (
                "You are helping a homeowner compare lightweight repair directions before writing a job post. "
                "Return strict JSON with one key named options. options must be an array of 2 to 4 objects with keys "
                "title, notes, pros, cons, estimated_cost_note."
            )
        else:
            system_prompt = (
                "You are helping a homeowner turn an intake planner into a contractor-ready project summary. "
                "Return strict JSON with keys: project_title, project_type, summary, known_details, "
                "missing_information, photo_notes, markup_notes, site_access_notes, contractor_questions, "
                "recommended_next_steps, contractor_ready_status. Arrays must contain short strings only. "
                "contractor_ready_status must be one of not_ready, needs_more_info, ready_for_estimate. "
                "Do not estimate labor cost. If mentioning material cost, keep it general and say prices vary by location, quality, and availability."
            )

        user_prompt = self._build_plan_text(plan)
        try:
            result = generate_text(
                feature=feature,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            payload = parse_ai_json(result["text"])
            self._record_ai_event(
                user=request.user,
                feature=feature,
                model_name=result["model"],
                prompt_chars=len(system_prompt) + len(user_prompt),
                response_chars=len(result["text"]),
                status_value=AIUsageEvent.Status.SUCCESS,
            )
        except (AIServiceError, ValueError, TypeError, json.JSONDecodeError) as exc:
            self._record_ai_event(
                user=request.user,
                feature=feature,
                model_name="",
                prompt_chars=len(system_prompt) + len(user_prompt),
                response_chars=0,
                status_value=AIUsageEvent.Status.ERROR,
            )
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        remaining_after, _ = get_ai_remaining_today(request.user)
        if action_name == "analyze_issue":
            return Response(
                {
                    "analysis": payload,
                    "remaining_today": remaining_after,
                    "daily_limit": daily_limit,
                }
            )
        if action_name == "generate_contractor_ready_project":
            normalized = {
                "project_title": str(payload.get("project_title") or plan.title or "").strip(),
                "project_type": str(payload.get("project_type") or plan.project_type or "").strip(),
                "summary": str(payload.get("summary") or "").strip(),
                "known_details": self._clean_string_list(payload.get("known_details") or []),
                "missing_information": self._clean_string_list(payload.get("missing_information") or []),
                "photo_notes": self._clean_string_list(payload.get("photo_notes") or []),
                "markup_notes": self._clean_string_list(payload.get("markup_notes") or []),
                "site_access_notes": self._clean_string_list(payload.get("site_access_notes") or []),
                "contractor_questions": self._clean_string_list(payload.get("contractor_questions") or []),
                "recommended_next_steps": self._clean_string_list(payload.get("recommended_next_steps") or []),
                "contractor_ready_status": str(payload.get("contractor_ready_status") or ProjectPlan.CONTRACTOR_READY_NOT_READY).strip(),
            }
            if normalized["contractor_ready_status"] not in {
                ProjectPlan.CONTRACTOR_READY_NOT_READY,
                ProjectPlan.CONTRACTOR_READY_NEEDS_MORE,
                ProjectPlan.CONTRACTOR_READY_READY,
            }:
                normalized["contractor_ready_status"] = ProjectPlan.CONTRACTOR_READY_NOT_READY

            plan.contractor_ready_summary_json = normalized
            plan.contractor_ready_status = normalized["contractor_ready_status"]
            plan.ai_generated_at = timezone.now()
            if normalized["project_title"] and (not plan.title or plan.title == "Untitled issue"):
                plan.title = normalized["project_title"]
            if normalized["summary"]:
                plan.ai_generated_issue_summary = normalized["summary"]
            plan.project_readiness_score = calculate_project_readiness_score(
                plan,
                template=get_project_intake_template(plan.project_type),
                guided_answers=plan.guided_answers_json or {},
                has_ai_summary=True,
            )
            plan.save(
                update_fields=[
                    "contractor_ready_summary_json",
                    "contractor_ready_status",
                    "ai_generated_at",
                    "title",
                    "ai_generated_issue_summary",
                    "project_readiness_score",
                    "updated_at",
                ]
            )
            return Response(
                {
                    "contractor_ready_project": normalized,
                    "remaining_today": remaining_after,
                    "daily_limit": daily_limit,
                }
            )
        return Response(
            {
                "options": payload.get("options") or [],
                "remaining_today": remaining_after,
                "daily_limit": daily_limit,
            }
        )

    def _clean_string_list(self, values):
        cleaned = []
        seen = set()
        for value in values or []:
            text = str(value or "").strip()
            key = text.lower()
            if text and key not in seen:
                cleaned.append(text)
                seen.add(key)
        return cleaned

    def _build_draft_payload(self, plan, ai_payload=None):
        selected_option = None
        for option in plan.options or []:
            if option.get("key") == plan.selected_option_key or option.get("is_selected"):
                selected_option = option
                break

        contractor_ready = plan.contractor_ready_summary_json or {}
        title = (
            (ai_payload or {}).get("title")
            or contractor_ready.get("project_title")
            or plan.title
            or "Project draft"
        )
        summary = (
            (ai_payload or {}).get("summary")
            or contractor_ready.get("summary")
            or plan.issue_summary
            or plan.notes[:400]
        )
        scope_of_work = (ai_payload or {}).get("scope_of_work") or plan.notes
        preferred_types = self._clean_string_list(
            (ai_payload or {}).get("preferred_contractor_types")
            or plan.contractor_types
            or plan.ai_suggested_contractor_types
        )
        material_preference = (ai_payload or {}).get("material_preference") or ""
        urgency = (ai_payload or {}).get("urgency_timing") or ""
        location_context = (ai_payload or {}).get("location_context") or plan.house_location
        link_urls = [item.get("url") for item in (plan.links or []) if isinstance(item, dict) and item.get("url")]
        budget_value = plan.budget_max or plan.budget_min
        project_area = str(plan.house_location or "").strip()
        project_summary = str(summary or "").strip()

        summary_parts = [project_summary]
        if contractor_ready.get("known_details"):
            summary_parts.append(f"Known details: {', '.join(contractor_ready.get('known_details') or [])}")
        if contractor_ready.get("missing_information"):
            summary_parts.append(
                f"Missing information to confirm: {', '.join(contractor_ready.get('missing_information') or [])}"
            )
        if scope_of_work:
            summary_parts.append(f"Scope of work: {scope_of_work.strip()}")
        if selected_option and selected_option.get("title"):
            summary_parts.append(f"Preferred direction: {selected_option.get('title')}")
        if material_preference:
            summary_parts.append(f"Material or product preference: {material_preference}")
        if location_context:
            summary_parts.append(f"Location context: {location_context}")
        if urgency:
            summary_parts.append(f"Timing: {urgency}")
        if plan.site_access:
            summary_parts.append(f"Site access: {plan.site_access}")

        return {
            "title": str(title).strip() or "Project draft",
            "summary": "\n\n".join([part for part in summary_parts if part]),
            "job_summary": project_summary,
            "category": str(plan.project_type or project_area)[:100],
            "location": project_area[:140],
            "budget": budget_value,
            "service_categories": preferred_types,
            "extra_links": link_urls,
            "highlights": ", ".join(
                [
                    x
                    for x in [
                        (selected_option or {}).get("title", ""),
                        plan.priority.title() if plan.priority else "",
                    ]
                    if x
                ]
            ),
            "is_job_posting": True,
            "is_public": False,
            "is_private": False,
            "post_privacy": "public",
            "compliance_confirmed": False,
        }

    @action(detail=True, methods=["post"], url_path="convert-to-draft")
    def convert_to_draft(self, request, pk=None):
        plan = self.get_object()
        title_or_summary = bool((plan.title or "").strip() or (plan.issue_summary or "").strip())
        note_or_image = bool((plan.notes or "").strip() or plan.images.exists())
        if not title_or_summary or not note_or_image:
            raise ValidationError(
                {
                    "detail": "Add a title or issue summary and at least one note or image before generating a draft."
                }
            )

        force_regenerate = bool(request.data.get("force_regenerate"))
        use_ai = bool(request.data.get("use_ai"))
        if plan.converted_job_post_id and not force_regenerate:
            raise ValidationError(
                {
                    "detail": "This plan already generated a draft job post.",
                    "draft_id": plan.converted_job_post_id,
                }
            )

        ai_payload = None
        system_prompt = ""
        user_prompt = ""
        model_name = ""
        if use_ai:
            feature = AIUsageEvent.Feature.PLANNER_DRAFT
            _, _, _, _ = ensure_planner_ai_allowed(request.user, feature)
            system_prompt = (
                "You are helping a homeowner turn planner notes into a job post draft. "
                "Return strict JSON with keys title, summary, scope_of_work, preferred_contractor_types, "
                "material_preference, location_context, urgency_timing. preferred_contractor_types must be an array of strings."
            )
            user_prompt = self._build_plan_text(plan)
            try:
                result = generate_text(
                    feature=feature,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
                model_name = result["model"]
                ai_payload = parse_ai_json(result["text"])
                self._record_ai_event(
                    user=request.user,
                    feature=feature,
                    model_name=model_name,
                    prompt_chars=len(system_prompt) + len(user_prompt),
                    response_chars=len(result["text"]),
                    status_value=AIUsageEvent.Status.SUCCESS,
                )
            except (AIServiceError, ValueError, TypeError, json.JSONDecodeError) as exc:
                self._record_ai_event(
                    user=request.user,
                    feature=feature,
                    model_name=model_name,
                    prompt_chars=len(system_prompt) + len(user_prompt),
                    response_chars=0,
                    status_value=AIUsageEvent.Status.ERROR,
                )
                return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        posting_mode = str(request.data.get("posting_mode") or "").strip()
        invite_usernames = request.data.get("private_contractor_usernames") or []
        if isinstance(invite_usernames, str):
            invite_usernames = [item.strip() for item in invite_usernames.split(",") if item.strip()]

        payload = self._build_draft_payload(plan, ai_payload=ai_payload)
        if posting_mode == ProjectPlan.VISIBILITY_LOCAL_PUBLIC:
            payload.update({"is_public": True, "post_privacy": "public", "is_private": False})
        elif posting_mode == ProjectPlan.VISIBILITY_INVITE_ONLY:
            payload.update(
                {
                    "is_public": False,
                    "post_privacy": "private",
                    "is_private": False,
                    "private_contractor_usernames": invite_usernames,
                }
            )
        else:
            posting_mode = ProjectPlan.VISIBILITY_DRAFT

        with transaction.atomic():
            serializer = ProjectSerializer(
                data=payload,
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            draft = serializer.save(owner=request.user)
            copied_images = []
            for image in plan.images.order_by("order", "id"):
                if not image.image:
                    continue
                image.image.open("rb")
                copied_images.append(
                    ProjectImage(
                        project=draft,
                        caption=image.caption,
                        order=image.order,
                        media_type=ProjectImage.MEDIA_TYPE_IMAGE,
                        processing_status=ProjectImage.STATUS_READY,
                        extra_data={
                            "source": "project_planner",
                            "source_plan_id": plan.id,
                            "source_plan_image_id": image.id,
                            "is_markup_snapshot": image.caption == "Project markup canvas",
                        },
                    )
                )
                copied_images[-1].image.save(
                    image.image.name.split("/")[-1],
                    ContentFile(image.image.read()),
                    save=False,
                )
                image.image.close()
            if copied_images:
                ProjectImage.objects.bulk_create(copied_images)

            plan.converted_job_post = draft
            plan.status = ProjectPlan.STATUS_CONVERTED
            plan.visibility_status = posting_mode
            plan.save(update_fields=["converted_job_post", "status", "visibility_status", "updated_at"])

        remaining_after, daily_limit = get_ai_remaining_today(request.user)
        return Response(
            {
                "draft_id": draft.id,
                "plan_id": plan.id,
                "remaining_today": remaining_after,
                "daily_limit": daily_limit,
            },
            status=status.HTTP_201_CREATED,
        )


class FavoriteProjectListView(generics.ListAPIView):
    serializer_class = ProjectFavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            ProjectFavorite.objects
            .filter(user=self.request.user)
            .select_related("project", "project__owner")
            .order_by("-created_at", "-id")
        )


class LikedProjectListView(generics.ListAPIView):
    serializer_class = ProjectLikeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            ProjectLike.objects
            .filter(user=self.request.user)
            .select_related("project", "project__owner")
            .order_by("-created_at", "-id")
        )


# ---------------------------------------------------
# Project bids
# ---------------------------------------------------
class ProjectBidListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/projects/<pk>/bids/
    POST /api/projects/<pk>/bids/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_project(self):
        project = get_object_or_404(Project.objects.select_related("owner").prefetch_related("invites"), pk=self.kwargs["pk"])
        if not can_view_project(project, self.request.user):
            raise PermissionDenied("You do not have access to this project.")
        return project

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProjectBidVersionSerializer
        return ProjectBidSerializer

    def get_queryset(self):
        project = self.get_project()
        user = self.request.user

        if project.owner_id == user.id:
            return (
                ProjectBid.objects.filter(project=project)
                .select_related("project", "contractor", "accepted_version")
                .prefetch_related("versions")
                .order_by("-updated_at", "-id")
            )

        return (
            ProjectBid.objects.filter(project=project, contractor=user)
            .select_related("project", "contractor", "accepted_version")
            .prefetch_related("versions")
            .order_by("-updated_at", "-id")
        )

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = ProjectBidSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        project = self.get_project()
        user = request.user
        require_contractor_user(user)

        if project.owner_id == user.id:
            return Response(
                {"detail": "Project owners cannot bid on their own project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not project.is_public:
            return Response(
                {"detail": "Bids are only allowed on public projects."},
                status=status.HTTP_403_FORBIDDEN,
            )

        bid, _created = ProjectBid.objects.get_or_create(
            project=project,
            contractor=user,
            defaults={"status": ProjectBid.STATUS_DRAFT},
        )

        if bid.status == ProjectBid.STATUS_ACCEPTED:
            return Response(
                {"detail": "Accepted bids cannot be revised."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        version_serializer = ProjectBidVersionSerializer(
            data=request.data,
            context={"request": request},
        )
        version_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            version = version_serializer.save(
                bid=bid,
                version_number=bid.next_version_number(),
                created_by=user,
            )

            bid.status = (
                ProjectBid.STATUS_SUBMITTED
                if version.version_number == 1
                else ProjectBid.STATUS_REVISED
            )
            bid.save(update_fields=["status", "updated_at"])

        bid_serializer = ProjectBidSerializer(bid, context={"request": request})
        return Response(bid_serializer.data, status=status.HTTP_201_CREATED)


class ProjectBidDetailView(generics.RetrieveAPIView):
    """
    GET /api/bids/<bid_id>/
    """
    serializer_class = ProjectBidSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "bid_id"

    def get_queryset(self):
        user = self.request.user
        return (
            ProjectBid.objects.filter(Q(project__owner=user) | Q(contractor=user))
            .select_related("project", "contractor", "accepted_version")
            .prefetch_related("versions")
            .order_by("-updated_at", "-id")
        )


class ProjectBidReviseView(APIView):
    """
    POST /api/bids/<bid_id>/revise/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, bid_id, *args, **kwargs):
        bid = get_object_or_404(
            ProjectBid.objects.select_related("project", "contractor"),
            id=bid_id,
        )
        require_contractor_user(request.user)

        if bid.contractor_id != request.user.id:
            return Response(
                {"detail": "Only the bidding contractor can revise this bid."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if bid.status == ProjectBid.STATUS_ACCEPTED:
            return Response(
                {"detail": "Accepted bids cannot be revised."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if bid.status == ProjectBid.STATUS_WITHDRAWN:
            return Response(
                {"detail": "Withdrawn bids cannot be revised."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        version_serializer = ProjectBidVersionSerializer(
            data=request.data,
            context={"request": request},
        )
        version_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            version_serializer.save(
                bid=bid,
                version_number=bid.next_version_number(),
                created_by=request.user,
            )
            bid.status = ProjectBid.STATUS_REVISED
            bid.save(update_fields=["status", "updated_at"])

        serializer = ProjectBidSerializer(bid, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectBidAcceptView(APIView):
    """
    POST /api/bids/<bid_id>/accept/
    Body optional: {"version_id": <id>}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, bid_id, *args, **kwargs):
        bid = get_object_or_404(
            ProjectBid.objects.select_related("project", "contractor", "accepted_version"),
            id=bid_id,
        )

        if bid.project.owner_id != request.user.id:
            return Response(
                {"detail": "Only the project owner can accept a bid."},
                status=status.HTTP_403_FORBIDDEN,
            )

        version_id = request.data.get("version_id")
        if version_id:
            accepted_version = get_object_or_404(ProjectBidVersion, id=version_id, bid=bid)
        else:
            accepted_version = bid.latest_version

        if not accepted_version:
            return Response(
                {"detail": "This bid has no submitted version to accept."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bid.accepted_version = accepted_version
        bid.status = ProjectBid.STATUS_ACCEPTED
        bid.save(update_fields=["accepted_version", "status", "updated_at"])

        serializer = ProjectBidSerializer(bid, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectBidDeclineView(APIView):
    """
    POST /api/bids/<bid_id>/decline/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, bid_id, *args, **kwargs):
        bid = get_object_or_404(
            ProjectBid.objects.select_related("project", "contractor"),
            id=bid_id,
        )

        if bid.project.owner_id != request.user.id:
            return Response(
                {"detail": "Only the project owner can decline a bid."},
                status=status.HTTP_403_FORBIDDEN,
            )

        bid.status = ProjectBid.STATUS_DECLINED
        bid.save(update_fields=["status", "updated_at"])

        serializer = ProjectBidSerializer(bid, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectBidWithdrawView(APIView):
    """
    POST /api/bids/<bid_id>/withdraw/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, bid_id, *args, **kwargs):
        bid = get_object_or_404(
            ProjectBid.objects.select_related("project", "contractor"),
            id=bid_id,
        )
        require_contractor_user(request.user)

        if bid.contractor_id != request.user.id:
            return Response(
                {"detail": "Only the bidding contractor can withdraw this bid."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if bid.status == ProjectBid.STATUS_ACCEPTED:
            return Response(
                {"detail": "Accepted bids cannot be withdrawn."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        bid.status = ProjectBid.STATUS_WITHDRAWN
        bid.save(update_fields=["status", "updated_at"])

        serializer = ProjectBidSerializer(bid, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------
# Private messaging
# ---------------------------------------------------
class ProjectThreadCreateView(generics.GenericAPIView):
    """
    POST /api/projects/<pk>/threads/
    GET  /api/projects/<pk>/threads/
    """
    serializer_class = MessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        project = get_object_or_404(Project, pk=kwargs.get("pk"))
        if not can_access_job_interactions(project, request.user):
            raise PermissionDenied("You do not have access to this private job.")
        sender = request.user
        receiver = project.owner

        if sender == receiver:
            return Response(
                {"detail": "You cannot start a private chat with yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thread, created = MessageThread.get_or_create_dm(
            sender,
            receiver,
            origin_project=project,
            initiated_by=sender,
        )

        ser = self.get_serializer(thread, context={"request": request})
        return Response(
            ser.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def get(self, request, *args, **kwargs):
        project = get_object_or_404(Project, pk=kwargs.get("pk"))
        if not can_access_job_interactions(project, request.user):
            raise PermissionDenied("You do not have access to this private job.")
        user = request.user
        if not user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        owner, client = MessageThread.normalize_users(user, project.owner)
        thread = MessageThread.objects.filter(owner=owner, client=client).first()
        if not thread:
            return Response(status=status.HTTP_404_NOT_FOUND)

        ser = self.get_serializer(thread, context={"request": request})
        return Response(ser.data)


class ThreadMessageListCreateView(generics.ListCreateAPIView):
    serializer_class = PrivateMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_thread(self):
        thread = get_object_or_404(MessageThread, id=self.kwargs.get("thread_id"))
        user = self.request.user

        if user not in (thread.owner, thread.client):
            raise PermissionDenied("You are not in this conversation.")
        if thread.is_blocked_for(user):
            raise PermissionDenied("This conversation is blocked.")
        return thread

    def get_queryset(self):
        thread = self.get_thread()
        return PrivateMessage.objects.filter(thread=thread).select_related("sender", "context_project")

    def perform_create(self, serializer):
        thread = self.get_thread()
        user = self.request.user

        other = thread.client if user.id == thread.owner_id else thread.owner
        ignored_until = thread.ignored_until_for(other)
        if (not thread.user_has_accepted(other)) and ignored_until and timezone.now() < ignored_until:
            raise permissions.PermissionDenied("Recipient ignored this request. Try again tomorrow.")

        if thread.is_blocked_for(user):
            raise PermissionDenied("This conversation is blocked.")

        message = serializer.save(sender=user, thread=thread)
        thread.updated_at = timezone.now()
        thread.save(update_fields=["updated_at"])
        return message


class InboxThreadListView(generics.ListAPIView):
    serializer_class = MessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        latest_messages = PrivateMessage.objects.filter(thread=OuterRef("pk")).order_by("-created_at")
        return (
            MessageThread.objects
            .filter(Q(owner=user) | Q(client=user))
            .select_related("owner", "client", "owner__profile", "client__profile")
            .annotate(
                latest_message_id=Subquery(latest_messages.values("id")[:1]),
                latest_message_text=Subquery(latest_messages.values("text")[:1]),
                latest_message_attachment_name=Subquery(
                    latest_messages.values("attachment_name")[:1]
                ),
                latest_message_created_at=Subquery(
                    latest_messages.values("created_at")[:1]
                ),
                latest_message_sender_username=Subquery(
                    latest_messages.values("sender__username")[:1]
                ),
            )
            .order_by("-updated_at")
        )


class MessageStartView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        recipient_username = (request.data.get("username") or "").strip()
        project_id = request.data.get("project_id")
        if not recipient_username:
            return Response(
                {"detail": "Missing username."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target = get_object_or_404(get_user_model(), username=recipient_username)

        if project_id:
            project = get_object_or_404(Project.objects.select_related("owner"), pk=project_id)
            if not can_view_project(project, request.user):
                raise PermissionDenied("You do not have access to this project.")
            if project.owner_id != target.id:
                return Response(
                    {"detail": "Project message recipient must be the project owner."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if target.id == request.user.id:
            return Response(
                {"detail": "You cannot message yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thread, created = MessageThread.get_or_create_dm(
            request.user,
            target,
            origin_project=None,
            initiated_by=request.user,
        )

        if not thread.user_has_accepted(request.user):
            thread.mark_accepted(request.user)

        return Response({"thread_id": thread.id}, status=status.HTTP_200_OK)


class ThreadMessagesView(generics.ListCreateAPIView):
    serializer_class = PrivateMessageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_thread(self):
        thread = get_object_or_404(MessageThread, id=self.kwargs.get("thread_id"))
        user = self.request.user

        if user not in (thread.owner, thread.client):
            raise PermissionDenied("You are not in this conversation.")

        if thread.is_blocked_for(user):
            raise PermissionDenied("This conversation is blocked.")

        return thread

    def get_queryset(self):
        thread = self.get_thread()
        return (
            PrivateMessage.objects
            .filter(thread=thread)
            .select_related("sender", "parent_message", "context_project")
            .prefetch_related("attachments")
        )

    def _parse_links(self, request):
        raw = request.data.get("links")
        if not raw:
            return []

        if isinstance(raw, list):
            return raw

        if isinstance(raw, str):
            try:
                import json
                parsed = json.loads(raw)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []

        return []

    def _get_parent_message(self, thread, request):
        parent_id = request.data.get("parent_message_id")
        if not parent_id:
            return None

        try:
            return PrivateMessage.objects.get(id=parent_id, thread=thread)
        except PrivateMessage.DoesNotExist:
            raise ValidationError({"parent_message_id": "Invalid parent message."})

    def _get_context_project(self, thread, request):
        project_id = request.data.get("context_project_id")
        if not project_id:
            return None

        project = get_object_or_404(Project.objects.select_related("owner"), pk=project_id)
        user = request.user
        other = thread.client if user.id == thread.owner_id else thread.owner

        if project.owner_id != other.id:
            raise ValidationError({"context_project_id": "Project context must belong to the other participant."})
        if not can_view_project(project, user):
            raise PermissionDenied("You do not have access to this project.")

        return project

    def perform_create(self, serializer):
        thread = self.get_thread()
        user = self.request.user

        if not thread.user_has_accepted(user):
            raise PermissionDenied("Message request not accepted yet.")

        parent_message = self._get_parent_message(thread, self.request)
        context_project = self._get_context_project(thread, self.request)

        msg = serializer.save(
            sender=user,
            thread=thread,
            parent_message=parent_message,
            context_project=context_project,
        )

        image_files = self.request.FILES.getlist("images")
        doc_files = self.request.FILES.getlist("documents")
        camera_files = self.request.FILES.getlist("camera_images")
        links = self._parse_links(self.request)

        for f in image_files:
            MessageAttachment.objects.create(
                message=msg,
                kind="image",
                file=f,
                original_name=getattr(f, "name", "") or "",
            )

        for f in doc_files:
            MessageAttachment.objects.create(
                message=msg,
                kind="document",
                file=f,
                original_name=getattr(f, "name", "") or "",
            )

        for f in camera_files:
            MessageAttachment.objects.create(
                message=msg,
                kind="camera",
                file=f,
                original_name=getattr(f, "name", "") or "",
            )

        for item in links:
            url = ""
            if isinstance(item, dict):
                url = (item.get("url") or "").strip()
            elif isinstance(item, str):
                url = item.strip()

            if url:
                MessageAttachment.objects.create(
                    message=msg,
                    kind="link",
                    url=url,
                    original_name="",
                )

        thread.updated_at = timezone.now()
        thread.save(update_fields=["updated_at"])
        return msg


class MessageDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, message_id, *args, **kwargs):
        msg = get_object_or_404(
            PrivateMessage.objects.select_related("thread", "sender"),
            id=message_id,
        )

        if msg.sender_id != request.user.id:
            return Response(
                {"detail": "You can only delete your own messages."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if timezone.now() > msg.created_at + timedelta(minutes=1):
            return Response(
                {"detail": "Delete window has expired."},
                status=status.HTTP_403_FORBIDDEN,
            )

        thread = msg.thread
        msg.delete()
        thread.updated_at = timezone.now()
        thread.save(update_fields=["updated_at"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class MessageAttachmentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, attachment_id, *args, **kwargs):
        attachment = get_object_or_404(
            MessageAttachment.objects.select_related("message", "message__thread"),
            id=attachment_id,
        )

        msg = attachment.message

        if msg.sender_id != request.user.id:
            return Response(
                {"detail": "You can only delete your own attachments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if timezone.now() > msg.created_at + timedelta(minutes=1):
            return Response(
                {"detail": "Delete window has expired."},
                status=status.HTTP_403_FORBIDDEN,
            )

        thread = msg.thread
        attachment.delete()
        thread.updated_at = timezone.now()
        thread.save(update_fields=["updated_at"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class MessagePrefillBidView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id, *args, **kwargs):
        require_contractor_user(request.user)

        message = get_object_or_404(
            PrivateMessage.objects.select_related(
                "thread",
                "thread__project",
                "thread__project__owner",
                "thread__owner",
                "thread__client",
                "sender",
            ),
            id=message_id,
        )
        thread = message.thread

        if not thread.user_is_participant(request.user):
            raise PermissionDenied("You do not have access to this conversation.")

        project = thread.project
        if not project:
            raise ValidationError({"detail": "This conversation is not linked to a project yet."})

        if project.owner_id == request.user.id:
            raise PermissionDenied("You cannot bid on your own project.")

        if not getattr(project, "is_job_posting", False):
            raise ValidationError({"detail": "This conversation is linked to a project that is not open for bidding."})

        if not can_access_job_interactions(project, request.user):
            raise PermissionDenied("You do not have access to bid on this project.")

        if Bid.objects.filter(project=project, contractor=request.user).exists():
            raise ValidationError({"detail": "You already have a bid for this project."})

        if Bid.objects.filter(project=project, status=Bid.STATUS_ACCEPTED).exists():
            raise ValidationError({"detail": "This job posting is already closed to new bids."})

        return Response(
            {
                "type": "bid",
                "source_message_id": message.id,
                "source_text": message.text or "",
                "thread_id": thread.id,
                "project_id": project.id,
                "project_title": project.title,
                "project_owner_username": getattr(project.owner, "username", ""),
                "prefill": {
                    "price_type": Bid.PRICE_TYPE_FIXED,
                    "amount": "",
                    "amount_min": "",
                    "amount_max": "",
                    "timeline_text": "",
                    "proposal_text": message.text or "",
                    "included_text": "",
                    "excluded_text": "",
                    "payment_terms": "",
                    "valid_until": "",
                },
            },
            status=status.HTTP_200_OK,
        )


class MessagePrefillProjectView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, message_id, *args, **kwargs):
        require_homeowner_user(request.user)

        message = get_object_or_404(
            PrivateMessage.objects.select_related(
                "thread",
                "thread__project",
                "thread__owner",
                "thread__owner__profile",
                "thread__client",
                "thread__client__profile",
                "sender",
            ),
            id=message_id,
        )
        thread = message.thread

        if not thread.user_is_participant(request.user):
            raise PermissionDenied("You do not have access to this conversation.")

        if thread.project_id:
            raise ValidationError({"detail": "This conversation is already linked to a project."})

        other_user = thread.client if request.user.id == thread.owner_id else thread.owner
        other_profile = getattr(other_user, "profile", None)
        invite_username = (
            other_user.username
            if getattr(other_profile, "profile_type", "") == "contractor"
            else ""
        )

        source_text = message.text or ""

        return Response(
            {
                "type": "project",
                "source_message_id": message.id,
                "source_text": source_text,
                "thread_id": thread.id,
                "suggested_private_invite_username": invite_username,
                "prefill": {
                    "title": suggest_project_title_from_message(source_text),
                    "summary": source_text,
                    "job_summary": source_text,
                    "category": "",
                    "location": "",
                    "budget": "",
                    "sqf": "",
                    "is_job_posting": True,
                    "is_public": False,
                    "post_privacy": "public",
                    "compliance_confirmed": False,
                    "private_contractor_usernames": [invite_username] if invite_username else [],
                },
            },
            status=status.HTTP_200_OK,
        )


class ThreadActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        action = (request.data.get("action") or "").lower().strip()
        thread = get_object_or_404(
            MessageThread.objects.select_related("owner", "client"), pk=pk
        )

        if not thread.user_is_participant(request.user):
            return Response(
                {"detail": "Not allowed."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if action == "accept":
            thread.mark_accepted(request.user)

        elif action == "block":
            thread.block_other(request.user)

        elif action == "ignore":
            until = timezone.now() + timedelta(days=1)
            thread.set_ignored_until(request.user, until)

        elif action == "unblock":
            thread.unblock_other(request.user)

        elif action == "delete":
            thread.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        else:
            return Response(
                {"detail": "Unknown action."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = MessageThreadSerializer(thread, context={"request": request})
        return Response(ser.data)


# ---------------------------------------------------
# BlockListView
# ---------------------------------------------------
class BlockListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageThreadSerializer

    def get_queryset(self):
        user = self.request.user
        return MessageThread.objects.filter(
            Q(owner=user, owner_blocked_client=True)
            | Q(client=user, client_blocked_owner=True)
        ).select_related("owner", "client", "owner__profile", "client__profile")


# ---------------------------------------------------
# Direct (non-project) messaging: start thread + messages
# ---------------------------------------------------
class DirectMessageStartView(MessageStartView):
    pass


class DirectThreadMessageListCreateView(ThreadMessagesView):
    pass

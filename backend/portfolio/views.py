# file: backend/portfolio/views.py
from django.db import models, transaction
from django.db.models import Count, OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import (
    Project,
    ProjectImage,
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
    ProjectCommentSerializer,
    MessageThreadSerializer,
    PrivateMessageSerializer,
    ProjectFavoriteSerializer,
    ProjectLikeSerializer,
    ProjectBidSerializer,
    ProjectBidVersionSerializer,
)
from .permissions import IsOwnerOrReadOnly, IsCommentAuthorOrReadOnly

User = get_user_model()


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
            qs = project.images.order_by("order", "id")
            ser = ProjectImageSerializer(qs, many=True, context={"request": request})
            return Response(ser.data)

        if project.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)

        files = request.FILES.getlist("images")
        captions = request.data.getlist("captions[]") or request.data.getlist("captions") or []

        created = []
        base_order = project.images.count()
        for idx, f in enumerate(files):
            caption = captions[idx] if idx < len(captions) else ""
            img = ProjectImage.objects.create(
                project=project,
                image=f,
                caption=caption,
                order=base_order + idx,
            )
            created.append(img)

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
        ser = self.get_serializer(qs, many=True, context={"request": request})
        return Response(ser.data)


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
        return PrivateMessage.objects.filter(thread=thread).select_related("sender")

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
        origin_project = None

        if project_id:
            origin_project = get_object_or_404(Project.objects.select_related("owner"), pk=project_id)
            if not can_view_project(origin_project, request.user):
                raise PermissionDenied("You do not have access to this project.")
            if origin_project.owner_id != target.id:
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
            origin_project=origin_project,
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
            .select_related("sender", "parent_message")
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

    def perform_create(self, serializer):
        thread = self.get_thread()
        user = self.request.user

        if not thread.user_has_accepted(user):
            raise PermissionDenied("Message request not accepted yet.")

        parent_message = self._get_parent_message(thread, self.request)

        msg = serializer.save(
            sender=user,
            thread=thread,
            parent_message=parent_message,
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

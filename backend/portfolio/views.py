# file: backend/portfolio/views.py
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.utils import timezone

from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import (
    Project,
    ProjectImage,
    ProjectComment,
    MessageThread,
    PrivateMessage,
)
from .serializers import (
    ProjectSerializer,
    ProjectImageSerializer,
    ProjectCommentSerializer,
    MessageThreadSerializer,
    PrivateMessageSerializer,
)
from .permissions import IsOwnerOrReadOnly, IsCommentAuthorOrReadOnly


# ---------------------------------------------------
# Comments: list + create
#   GET  /api/projects/<pk>/comments/
#   POST /api/projects/<pk>/comments/
# ---------------------------------------------------
class ProjectCommentListCreateView(generics.ListCreateAPIView):
  """
  GET  /api/projects/<pk>/comments/   -> list comments for project
  POST /api/projects/<pk>/comments/   -> add comment (auth required)
  """
  serializer_class = ProjectCommentSerializer
  permission_classes = [permissions.IsAuthenticatedOrReadOnly]

  def get_queryset(self):
      project_id = self.kwargs["pk"]
      return (
          ProjectComment.objects
          .filter(project_id=project_id)
          .order_by("-created_at")
      )

class ProjectCommentDetailView(generics.RetrieveUpdateDestroyAPIView):
  """
  Retrieve, update, or delete a single comment for a project.
  Only the author can update/delete.
  """
  serializer_class = ProjectCommentSerializer
  permission_classes = [
      permissions.IsAuthenticatedOrReadOnly,
      IsCommentAuthorOrReadOnly,
  ]
  lookup_field = "id"          # model field
  lookup_url_kwarg = "comment_id"  # URL kwarg: <int:comment_id>

  def get_queryset(self):
      project_id = self.kwargs["pk"]
      # Only allow comments belonging to this project
      return ProjectComment.objects.filter(project_id=project_id)


# ---------------------------------------------------
# Projects + images
# ---------------------------------------------------
class ProjectViewSet(viewsets.ModelViewSet):
  queryset = Project.objects.select_related("owner").all()
  serializer_class = ProjectSerializer
  permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
  parser_classes = [JSONParser, MultiPartParser, FormParser]

  def get_queryset(self):
      qs = Project.objects.select_related("owner").all()
      request = self.request

      # Only public projects for anonymous users
      if not request.user.is_authenticated:
          return qs.filter(is_public=True)

      # For logged in users: see own + public
      return qs.filter(Q(is_public=True) | Q(owner=request.user)).distinct()

  def perform_create(self, serializer):
      serializer.save(owner=self.request.user)

  def perform_update(self, serializer):
      # Prevent owner from being changed via API
      serializer.save(owner=self.request.user)

  @action(detail=True, methods=["get", "post"], url_path="images")
  def images(self, request, pk=None):
      """
      GET  /api/projects/:id/images/         → list images
      POST /api/projects/:id/images/         → upload one or more images
      """
      project = self.get_object()

      if request.method.lower() == "get":
          qs = project.images.order_by("order", "id")
          ser = ProjectImageSerializer(qs, many=True, context={"request": request})
          return Response(ser.data)

      # POST: upload images
      if project.owner != request.user:
          return Response(status=status.HTTP_403_FORBIDDEN)

      files = request.FILES.getlist("images")
      captions = (
          request.data.getlist("captions[]")
          or request.data.getlist("captions")
          or []
      )

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
      """
      PATCH /projects/:id/images/:img_id/   → update caption/alt/order
      DELETE /projects/:id/images/:img_id/  → delete image
      """
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
      """
      DELETE /projects/:id/images/:img_id/  → delete image
      """
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

      # PATCH
      ser = ProjectImageSerializer(
          img,
          data=request.data,
          partial=True,
          context={"request": request},
      )
      ser.is_valid(raise_exception=True)
      ser.save()
      return Response(ser.data, status=status.HTTP_200_OK)

# ---------------------------------------------------
# Private messaging
# ---------------------------------------------------
class ProjectThreadCreateView(generics.GenericAPIView):
    """
    Ensure a private thread exists between the requesting user and the project owner.
    POST /api/projects/<pk>/threads/
    """

    serializer_class = MessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        project = get_object_or_404(Project, pk=kwargs.get("pk"))
        client = request.user

        thread, created = MessageThread.objects.get_or_create(
            project=project, client=client, defaults={"owner": project.owner}
        )
        serializer = self.get_serializer(thread, context={"request": request})
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)

    def get(self, request, *args, **kwargs):
        project = get_object_or_404(Project, pk=kwargs.get("pk"))
        thread = MessageThread.objects.filter(
            project=project, client=request.user
        ).first()
        if not thread:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(thread, context={"request": request})
        return Response(serializer.data)


class ThreadMessageListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/projects/<pk>/threads/<thread_id>/messages/
    POST /api/projects/<pk>/threads/<thread_id>/messages/
    """

    serializer_class = PrivateMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_thread(self):
        return get_object_or_404(
            MessageThread, id=self.kwargs.get("thread_id"), project_id=self.kwargs.get("pk")
        )

    def get_queryset(self):
        thread = self.get_thread()
        user = self.request.user
        if user not in (thread.owner, thread.client):
            return PrivateMessage.objects.none()
        return thread.messages.select_related("sender").all()

    def perform_create(self, serializer):
        thread = self.get_thread()
        user = self.request.user
        if user not in (thread.owner, thread.client):
            raise permissions.PermissionDenied("You cannot post to this thread.")

        message = serializer.save(sender=user, thread=thread)
        # keep thread bumped for inbox
        thread.updated_at = timezone.now()
        thread.save(update_fields=["updated_at"])
        return message


class InboxThreadListView(generics.ListAPIView):
    """
    GET /api/inbox/threads/
    Returns threads where the user is a participant with the latest message.
    """

    serializer_class = MessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            MessageThread.objects.filter(Q(owner=user) | Q(client=user))
            .select_related("project", "owner", "client", "owner__profile", "client__profile")
            .prefetch_related("messages")
            .order_by("-updated_at")
        )

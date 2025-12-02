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
    Ensure a direct-message thread exists between requesting user and project owner.
    This is now just a DM entry point, not a project-specific thread.

    POST /api/projects/<pk>/threads/
    GET  /api/projects/<pk>/threads/  (get DM, if it exists)
    """

    serializer_class = MessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        project = get_object_or_404(Project, pk=kwargs.get("pk"))
        sender = request.user
        receiver = project.owner

        if sender == receiver:
            return Response(
                {"detail": "You cannot start a private chat with yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create or fetch DM between sender & project owner
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
    """
    GET  /api/projects/<pk>/threads/<thread_id>/messages/
        (pk is ignored, kept only for URL compatibility)
    POST /api/projects/<pk>/threads/<thread_id>/messages/
    """

    serializer_class = PrivateMessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_thread(self):
        thread = get_object_or_404(MessageThread, id=self.kwargs.get("thread_id"))
        user = self.request.user
        if user not in (thread.owner, thread.client):
            raise permissions.PermissionDenied("You are not in this conversation.")
        if thread.is_blocked_for(user):
            raise permissions.PermissionDenied("This conversation is blocked.")
        return thread

    def get_queryset(self):
        thread = self.get_thread()
        return thread.messages.select_related("sender").all()

    def perform_create(self, serializer):
        thread = self.get_thread()
        user = self.request.user

        # If the *other* user blocked me, do not allow sending.
        if thread.is_blocked_for(user):
            raise permissions.PermissionDenied("This conversation is blocked.")

        message = serializer.save(sender=user, thread=thread)
        thread.updated_at = timezone.now()
        thread.save(update_fields=["updated_at"])
        return message



class InboxThreadListView(generics.ListAPIView):
    """
    GET /api/inbox/threads/
    Returns all threads the user participates in, split into:
    - accepted inbox threads
    - pending message requests
    """

    serializer_class = MessageThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = (
            MessageThread.objects.filter(Q(owner=user) | Q(client=user))
            .select_related("owner", "client", "owner__profile", "client__profile")
            .prefetch_related("messages")
            .order_by("-updated_at")
        )
        # Serializer will decide if it's inbox vs request based on flags.
        return qs


class ThreadActionView(generics.GenericAPIView):
    """
    POST /api/inbox/threads/<thread_id>/accept/
    POST /api/inbox/threads/<thread_id>/block/
    POST /api/inbox/threads/<thread_id>/ignore/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageThreadSerializer

    def get_thread(self):
        thread = get_object_or_404(MessageThread, id=self.kwargs.get("thread_id"))
        user = self.request.user

        # Make sure the current user is one of the participants
        if user not in (thread.owner, thread.client):
            raise permissions.PermissionDenied("Not your thread.")
        return thread

    def post(self, request, *args, **kwargs):
        action = self.kwargs.get("action")
        thread = self.get_thread()
        user = request.user

        # --- ACCEPT: mark this user as having accepted the conversation ---
        if action == "accept":
            # These fields must exist on your MessageThread model
            # (BooleanFields with default=False)
            if hasattr(thread, "owner_has_accepted") and hasattr(thread, "client_has_accepted"):
                if user == thread.owner:
                    thread.owner_has_accepted = True
                elif user == thread.client:
                    thread.client_has_accepted = True
                thread.save(update_fields=["owner_has_accepted", "client_has_accepted"])
            # if you haven't added those fields yet, this will just be a no-op

        # --- BLOCK: block the other profile in this thread ---
        elif action == "block":
            if hasattr(thread, "owner_blocked_client") and hasattr(thread, "client_blocked_owner"):
                if user == thread.owner:
                    thread.owner_blocked_client = True
                elif user == thread.client:
                    thread.client_blocked_owner = True
                thread.save(update_fields=["owner_blocked_client", "client_blocked_owner"])

        # --- IGNORE: treat as dismissing request (optional archive flags) ---
        elif action == "ignore":
            if hasattr(thread, "owner_archived") and hasattr(thread, "client_archived"):
                if user == thread.owner:
                    thread.owner_archived = True
                elif user == thread.client:
                    thread.client_archived = True
                thread.save(update_fields=["owner_archived", "client_archived"])

        else:
            return Response(
                {"detail": "Unknown action."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = self.get_serializer(thread, context={"request": request})
        return Response(ser.data)


class BlockListView(generics.ListAPIView):
    """
    GET /api/inbox/blocked/
    Return the list of profiles the current user has blocked.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageThreadSerializer  # or a dedicated small serializer

    def get_queryset(self):
        user = self.request.user
        return MessageThread.objects.filter(
            Q(owner=user, owner_blocked_client=True)
            | Q(client=user, client_blocked_owner=True)
        ).select_related("owner", "client", "owner__profile", "client__profile")



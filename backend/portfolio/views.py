# file: backend/portfolio/views.py
from django.db.models import Q
from django.shortcuts import get_object_or_404

from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import Project, ProjectImage, ProjectComment
from .serializers import (
    ProjectSerializer,
    ProjectImageSerializer,
    ProjectCommentSerializer,
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

  def perform_create(self, serializer):
      project_id = self.kwargs["pk"]
      serializer.save(
          author=self.request.user,
          project_id=project_id,
      )


# ---------------------------------------------------
# Comment detail: retrieve / update / delete
#   PATCH  /api/projects/<pk>/comments/<comment_id>/
#   DELETE /api/projects/<pk>/comments/<comment_id>/
#   (only author can edit/delete)
# ---------------------------------------------------
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

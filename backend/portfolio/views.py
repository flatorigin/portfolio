from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.db.models import Q
from .models import Project, ProjectImage
from .serializers import ProjectSerializer, ProjectImageSerializer
from .permissions import IsOwnerOrReadOnly

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related("owner").all()
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        owner = self.request.query_params.get("owner")
        if owner:
            qs = qs.filter(owner__username=owner)
        if self.request.user.is_authenticated:
            return qs.filter(Q(is_public=True) | Q(owner=self.request.user))
        return qs.filter(is_public=True)

    @action(detail=True, methods=["get","post"], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, pk=None):
        """
        GET  /projects/:id/images/      → list images
        POST /projects/:id/images/      → upload images (and optional captions[])
        """
        project = self.get_object()
        if request.method == "GET":
            qs = ProjectImage.objects.filter(project=project).order_by("order","id")
            ser = ProjectImageSerializer(qs, many=True, context={"request": request})
            return Response(ser.data)

        # POST (upload)
        if project.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        files = request.FILES.getlist("images")
        captions = request.data.getlist("captions")
        created = []
        for i, f in enumerate(files):
            cap = captions[i] if i < len(captions) else ""
            img = ProjectImage.objects.create(project=project, image=f, caption=cap, order=i)
            created.append(ProjectImageSerializer(img, context={"request": request}).data)
        return Response(created, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path="images/(?P<img_id>[^/.]+)")
    def delete_image(self, request, pk=None, img_id=None):
        """
        DELETE /projects/:id/images/:img_id/
        """
        project = self.get_object()
        try:
            img = ProjectImage.objects.get(id=img_id, project=project)
        except ProjectImage.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if project.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        img.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

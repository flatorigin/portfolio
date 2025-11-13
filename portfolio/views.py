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

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, pk=None):
        project = self.get_object()
        if project.owner != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        files = request.FILES.getlist("images")
        created = []
        for i, f in enumerate(files):
            img = ProjectImage.objects.create(project=project, image=f, order=i)
            created.append(ProjectImageSerializer(img).data)
        return Response(created, status=201)

class ProjectImageViewSet(viewsets.ModelViewSet):
    queryset = ProjectImage.objects.all()
    serializer_class = ProjectImageSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return ProjectImage.objects.filter(project__owner=self.request.user)

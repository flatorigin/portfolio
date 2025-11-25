# file: backend/portfolio/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ProjectViewSet, ProjectCommentListCreateView

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = [
    # All the /projects/ routes provided by ProjectViewSet
    # - GET    /api/projects/          (list)
    # - POST   /api/projects/          (create)
    # - GET    /api/projects/<id>/     (retrieve)
    # - PATCH  /api/projects/<id>/     (update)
    # - plus any @action endpoints you already have
    path("", include(router.urls)),

    # Comments for a project
    # - GET  /api/projects/<pk>/comments/  -> list comments
    # - POST /api/projects/<pk>/comments/  -> create comment (auth required)
    path(
        "projects/<int:pk>/comments/",
        ProjectCommentListCreateView.as_view(),
        name="project-comments",
    ),
]

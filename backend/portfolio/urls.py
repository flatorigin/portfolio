# file: backend/portfolio/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProjectViewSet,
    ProjectCommentListCreateView,
    ProjectCommentDetailView,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = [
    # All /api/projects/ routes from ProjectViewSet
    path("", include(router.urls)),

    # Comments list + create for a project
    #   GET  /api/projects/<pk>/comments/
    #   POST /api/projects/<pk>/comments/
    path(
        "projects/<int:pk>/comments/",
        ProjectCommentListCreateView.as_view(),
        name="project-comments",
    ),

    # Single comment detail (edit/delete own comment)
    #   PATCH /api/projects/<pk>/comments/<comment_id>/
    #   DELETE /api/projects/<pk>/comments/<comment_id>/
    path(
        "projects/<int:pk>/comments/<int:comment_id>/",
        ProjectCommentDetailView.as_view(),
        name="project-comment-detail",
    ),
]

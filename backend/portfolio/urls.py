# file: backend/portfolio/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ProjectViewSet,
    ProjectCommentListCreateView,
    ProjectCommentDetailView,
    ProjectThreadCreateView,
    ThreadMessageListCreateView,
    InboxThreadListView,
    ThreadActionView,
    BlockListView,
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

    # Private threads
    path(
        "projects/<int:pk>/threads/",
        ProjectThreadCreateView.as_view(),
        name="project-thread",
    ),
    path(
        "projects/<int:pk>/threads/<int:thread_id>/messages/",
        ThreadMessageListCreateView.as_view(),
        name="project-thread-messages",
    ),

    # Global inbox list (threads)
    path("inbox/threads/", InboxThreadListView.as_view(), name="inbox-threads"),

    # Thread actions: accept / block / ignore
    path(
        "inbox/threads/<int:pk>/actions/",
        ThreadActionView.as_view(),
        name="inbox-thread-actions",
    ),

    # Block list
    path("inbox/blocked/", BlockListView.as_view(), name="inbox-blocked"),

]
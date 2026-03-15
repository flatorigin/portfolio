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
    FavoriteProjectListView,
    MessageStartView,
    ThreadMessagesView,
    DirectMessageStartView,
    DirectThreadMessageListCreateView,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = [
    path("api/", include(router.urls)),

    path(
        "api/favorites/projects/",
        FavoriteProjectListView.as_view(),
        name="favorite-projects",
    ),
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

    # Favorites list for current user
    #   GET /api/favorites/projects/
    path(
        "favorites/projects/",
        FavoriteProjectListView.as_view(),
        name="favorite-projects",
    ),
    path("messages/start/", MessageStartView.as_view(), name="messages-start"),
    path("messages/threads/<int:thread_id>/messages/", ThreadMessagesView.as_view(), name="thread-messages"),
    path("messages/start/", DirectMessageStartView.as_view(), name="dm-start"),
    path("messages/threads/<int:thread_id>/messages/", DirectThreadMessageListCreateView.as_view(), name="dm-thread-messages"),
]


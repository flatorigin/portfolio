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
    LikedProjectListView,
    DirectMessageStartView,
    DirectThreadMessageListCreateView,
    PublishTestimonialView,
    UnpublishTestimonialView,
    MessageDetailView,
    MessageAttachmentDeleteView,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")

urlpatterns = [
    # DRF router (projects CRUD)
    path("", include(router.urls)),

    # Favorites list for current user
    path("favorites/projects/", FavoriteProjectListView.as_view(), name="favorite-projects"),
    path("likes/projects/", LikedProjectListView.as_view(), name="liked-projects"),

    # Comments
    path("projects/<int:pk>/comments/", ProjectCommentListCreateView.as_view(), name="project-comments"),
    path(
        "projects/<int:pk>/comments/<int:comment_id>/",
        ProjectCommentDetailView.as_view(),
        name="project-comment-detail",
    ),
    path(
        "projects/<int:pk>/comments/<int:comment_id>/publish-testimonial/",
        PublishTestimonialView.as_view(),
        name="publish-testimonial",
    ),
    path(
        "projects/<int:pk>/comments/<int:comment_id>/unpublish-testimonial/",
        UnpublishTestimonialView.as_view(),
        name="unpublish-testimonial",
    ),

    # Project-tied private threads (existing system)
    path("projects/<int:pk>/threads/", ProjectThreadCreateView.as_view(), name="project-thread"),
    path(
        "projects/<int:pk>/threads/<int:thread_id>/messages/",
        ThreadMessageListCreateView.as_view(),
        name="project-thread-messages",
    ),

    # Global inbox (threads)
    path("inbox/threads/", InboxThreadListView.as_view(), name="inbox-threads"),
    path("inbox/threads/<int:pk>/actions/", ThreadActionView.as_view(), name="inbox-thread-actions"),
    path("inbox/blocked/", BlockListView.as_view(), name="inbox-blocked"),

    # Direct messages (no project context required)
    path("messages/start/", DirectMessageStartView.as_view(), name="dm-start"),
    path(
        "messages/threads/<int:thread_id>/messages/",
        DirectThreadMessageListCreateView.as_view(),
        name="dm-thread-messages",
    ),
    path("messages/<int:message_id>/", MessageDetailView.as_view(), name="message-detail"),
    path(
        "message-attachments/<int:attachment_id>/",
        MessageAttachmentDeleteView.as_view(),
        name="message-attachment-delete",
    ),
]

from django.urls import path
from .views import BidViewSet

bid_list = BidViewSet.as_view({
    "get": "list",
    "post": "create",
})

bid_detail = BidViewSet.as_view({
    "get": "retrieve",
    "patch": "partial_update",
})

project_bids = BidViewSet.as_view({
    "get": "project_bids",
    "post": "project_bids",
})

bid_accept = BidViewSet.as_view({
    "post": "accept",
})

bid_decline = BidViewSet.as_view({
    "post": "decline",
})

bid_request_revision = BidViewSet.as_view({
    "post": "request_revision",
})

bid_reopen = BidViewSet.as_view({
    "post": "reopen",
})

bid_revise = BidViewSet.as_view({
    "post": "revise",
})

bid_withdraw = BidViewSet.as_view({
    "post": "withdraw",
})

urlpatterns = [
    path("bids/", bid_list, name="bid-list"),
    path("bids/<int:pk>/", bid_detail, name="bid-detail"),
    path("bids/<int:pk>/revise/", bid_revise, name="bid-revise"),
    path("bids/<int:pk>/accept/", bid_accept, name="bid-accept"),
    path("bids/<int:pk>/decline/", bid_decline, name="bid-decline"),
    path("bids/<int:pk>/request-revision/", bid_request_revision, name="bid-request-revision"),
    path("bids/<int:pk>/reopen/", bid_reopen, name="bid-reopen"),
    path("bids/<int:pk>/withdraw/", bid_withdraw, name="bid-withdraw"),
    path("projects/<int:project_id>/bids/", project_bids, name="project-bids"),
]

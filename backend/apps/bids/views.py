from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from portfolio.models import MessageThread, PrivateMessage, Project
from portfolio.access import can_access_job_interactions, can_view_project

from .models import Bid
from .serializers import BidSerializer


def require_contractor_user(user):
    profile = getattr(user, "profile", None)
    if getattr(profile, "profile_type", "") != "contractor":
        raise PermissionDenied("Only contractor accounts can submit or manage bids.")


class BidViewSet(viewsets.ModelViewSet):
    queryset = Bid.objects.all().select_related("project", "contractor", "project__owner")
    serializer_class = BidSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        return (
            Bid.objects.filter(Q(contractor=user) | Q(project__owner=user))
            .select_related("project", "contractor", "project__owner")
        )

    def perform_create(self, serializer):
        require_contractor_user(self.request.user)
        project = serializer.validated_data["project"]

        if project.owner == self.request.user:
            raise PermissionDenied("You cannot bid on your own project.")

        if not getattr(project, "is_job_posting", False):
            raise ValidationError("This project is not open for bidding.")

        if not can_access_job_interactions(project, self.request.user):
            raise PermissionDenied("You do not have access to bid on this job.")

        if Bid.objects.filter(project=project, status=Bid.STATUS_ACCEPTED).exists():
            raise ValidationError("This job posting is closed to new bids.")

        active_bid_count = Bid.objects.filter(
            project=project,
            status__in=[
                Bid.STATUS_PENDING,
                Bid.STATUS_REVISION_REQUESTED,
                Bid.STATUS_ACCEPTED,
            ],
        ).count()
        if active_bid_count >= 6:
            raise ValidationError("This job posting already has the maximum of 6 active bids.")

        serializer.save(contractor=self.request.user)

    def perform_update(self, serializer):
        bid = self.get_object()
        require_contractor_user(self.request.user)

        if bid.contractor_id != self.request.user.id:
            raise PermissionDenied("Only the contractor can revise this bid.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be revised.")

        serializer.save(status=Bid.STATUS_PENDING)

    @action(detail=False, methods=["get", "post"], url_path=r"projects/(?P<project_id>\d+)/bids")
    def project_bids(self, request, project_id=None):
        project = get_object_or_404(Project.objects.select_related("owner").prefetch_related("invites"), pk=project_id)

        if not can_view_project(project, request.user):
            raise PermissionDenied("You do not have access to this project.")

        if request.method == "GET":
            if project.owner_id == request.user.id:
                qs = Bid.objects.filter(project=project).select_related("project", "contractor", "project__owner")
            else:
                qs = Bid.objects.filter(project=project, contractor=request.user).select_related(
                    "project", "contractor", "project__owner"
                )
            serializer = self.get_serializer(qs, many=True)
            return Response(serializer.data)

        require_contractor_user(request.user)

        if project.owner_id == request.user.id:
            raise PermissionDenied("You cannot bid on your own project.")

        if not getattr(project, "is_job_posting", False):
            raise ValidationError("This project is not open for bidding.")

        if not can_access_job_interactions(project, request.user):
            raise PermissionDenied("You do not have access to bid on this job.")

        if Bid.objects.filter(project=project, status=Bid.STATUS_ACCEPTED).exists():
            raise ValidationError("This job posting is closed to new bids.")

        active_bid_count = Bid.objects.filter(
            project=project,
            status__in=[
                Bid.STATUS_PENDING,
                Bid.STATUS_REVISION_REQUESTED,
                Bid.STATUS_ACCEPTED,
            ],
        ).count()
        if active_bid_count >= 6:
            raise ValidationError("This job posting already has the maximum of 6 active bids.")

        existing = Bid.objects.filter(project=project, contractor=request.user).first()
        if existing:
            raise ValidationError("You already submitted a bid for this project.")

        data = request.data.copy()
        data["project"] = project.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(contractor=request.user)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="revise")
    def revise(self, request, pk=None):
        bid = self.get_object()
        require_contractor_user(request.user)

        if bid.contractor_id != request.user.id:
            raise PermissionDenied("Only the contractor can revise this bid.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be revised.")

        serializer = self.get_serializer(bid, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(status=Bid.STATUS_PENDING)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        bid = self.get_object()

        if bid.project.owner_id != request.user.id:
            raise PermissionDenied("Only the project owner can accept a bid.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be accepted.")

        with transaction.atomic():
            bid.status = Bid.STATUS_ACCEPTED
            bid.accepted_at = timezone.now()
            bid.accepted_by = request.user
            bid.owner_response_note = request.data.get("owner_response_note", "") or ""
            bid.save(update_fields=["status", "accepted_at", "accepted_by", "owner_response_note"])

            thread, _ = MessageThread.get_or_create_dm(
                bid.project.owner,
                bid.contractor,
                origin_project=bid.project,
                initiated_by=bid.project.owner,
            )
            if not thread.owner_has_accepted or not thread.client_has_accepted:
                thread.owner_has_accepted = True
                thread.client_has_accepted = True
                thread.save(update_fields=["owner_has_accepted", "client_has_accepted"])

            acceptance_note = (bid.owner_response_note or "").strip()
            text = f'Your bid for "{bid.project.title}" was accepted.'
            if acceptance_note:
                text = f"{text}\n\nOwner note:\n{acceptance_note}"

            PrivateMessage.objects.create(
                thread=thread,
                sender=bid.project.owner,
                text=text,
            )
            thread.updated_at = timezone.now()
            thread.save(update_fields=["updated_at"])

            Bid.objects.filter(project=bid.project).exclude(pk=bid.pk).exclude(
                status=Bid.STATUS_WITHDRAWN
            ).update(status=Bid.STATUS_DECLINED)

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        bid = self.get_object()

        if bid.project.owner_id != request.user.id:
            raise PermissionDenied("Only the project owner can decline a bid.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be declined.")

        bid.owner_response_note = request.data.get("owner_response_note", "") or ""
        bid.status = Bid.STATUS_DECLINED
        bid.save(update_fields=["status", "owner_response_note"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="request-revision")
    def request_revision(self, request, pk=None):
        bid = self.get_object()

        if bid.project.owner_id != request.user.id:
            raise PermissionDenied("Only the project owner can request a revision.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be sent back for revision.")

        note = request.data.get("owner_response_note", "") or request.data.get("revision_note", "") or ""
        if not str(note).strip():
            raise ValidationError({"owner_response_note": "Revision note is required."})

        bid.status = Bid.STATUS_REVISION_REQUESTED
        bid.owner_response_note = note
        bid.save(update_fields=["status", "owner_response_note"])

        thread, _ = MessageThread.get_or_create_dm(
            bid.project.owner,
            bid.contractor,
            origin_project=bid.project,
            initiated_by=bid.project.owner,
        )
        if not thread.owner_has_accepted or not thread.client_has_accepted:
            thread.owner_has_accepted = True
            thread.client_has_accepted = True
            thread.save(update_fields=["owner_has_accepted", "client_has_accepted"])

        text = f'Your bid for "{bid.project.title}" needs revision.'
        if note:
            text = f"{text}\n\nOwner note:\n{note}"

        PrivateMessage.objects.create(
            thread=thread,
            sender=bid.project.owner,
            text=text,
        )
        thread.updated_at = timezone.now()
        thread.save(update_fields=["updated_at"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        bid = self.get_object()

        if bid.project.owner_id != request.user.id:
            raise PermissionDenied("Only the project owner can reopen a bid.")

        note = request.data.get("owner_response_note", "") or request.data.get("reopen_note", "") or ""
        if not str(note).strip():
            raise ValidationError({"owner_response_note": "Reopen note is required."})

        if bid.status == Bid.STATUS_DECLINED:
            if Bid.objects.filter(project=bid.project, status=Bid.STATUS_ACCEPTED).exclude(pk=bid.pk).exists():
                raise ValidationError("This job posting already has an accepted bid and cannot be reopened.")

            bid.status = Bid.STATUS_REVISION_REQUESTED
            bid.owner_response_note = note
            bid.save(update_fields=["status", "owner_response_note"])

            serializer = self.get_serializer(bid)
            return Response(serializer.data)

        if bid.status != Bid.STATUS_ACCEPTED:
            raise ValidationError("Only declined or accepted bids can be reopened.")

        with transaction.atomic():
            bid.status = Bid.STATUS_REVISION_REQUESTED
            bid.accepted_at = None
            bid.accepted_by = None
            bid.owner_response_note = note
            bid.save(update_fields=["status", "accepted_at", "accepted_by", "owner_response_note"])

            thread, _ = MessageThread.get_or_create_dm(
                bid.project.owner,
                bid.contractor,
                origin_project=bid.project,
                initiated_by=bid.project.owner,
            )
            if not thread.owner_has_accepted or not thread.client_has_accepted:
                thread.owner_has_accepted = True
                thread.client_has_accepted = True
                thread.save(update_fields=["owner_has_accepted", "client_has_accepted"])

            text = f'The job posting for "{bid.project.title}" was reopened.'
            if note:
                text = f"{text}\n\nOwner note:\n{note}"

            PrivateMessage.objects.create(
                thread=thread,
                sender=bid.project.owner,
                text=text,
            )
            thread.updated_at = timezone.now()
            thread.save(update_fields=["updated_at"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        bid = self.get_object()
        require_contractor_user(request.user)

        if bid.contractor_id != request.user.id:
            raise PermissionDenied("Only the contractor can withdraw this bid.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be withdrawn.")

        bid.status = Bid.STATUS_WITHDRAWN
        bid.save(update_fields=["status"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from portfolio.models import Project, MessageThread, PrivateMessage
from .models import Bid
from .serializers import BidSerializer


class BidViewSet(viewsets.ModelViewSet):
    queryset = Bid.objects.all().select_related("project", "contractor")
    serializer_class = BidSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        return (
            Bid.objects.filter(Q(contractor=user) | Q(project__owner=user))
            .select_related("project", "contractor")
        )

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]

        if project.owner == self.request.user:
            raise PermissionDenied("You cannot bid on your own project.")

        if not getattr(project, "is_job_posting", False):
            raise ValidationError("This project is not open for bidding.")

        if Bid.objects.filter(project=project, status=Bid.STATUS_ACCEPTED).exists():
            raise ValidationError("This job posting is closed to new bids.")

        serializer.save(contractor=self.request.user)

    def perform_update(self, serializer):
        bid = self.get_object()

        if bid.contractor_id != self.request.user.id:
            raise PermissionDenied("Only the contractor can revise this bid.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be revised.")

        serializer.save(status=Bid.STATUS_PENDING)

    @action(detail=False, methods=["get", "post"], url_path=r"projects/(?P<project_id>\d+)/bids")
    def project_bids(self, request, project_id=None):
        project = get_object_or_404(Project.objects.select_related("owner"), pk=project_id)

        if request.method == "GET":
            if project.owner_id == request.user.id:
                qs = Bid.objects.filter(project=project).select_related("project", "contractor")
            else:
                qs = Bid.objects.filter(project=project, contractor=request.user).select_related("project", "contractor")

            serializer = self.get_serializer(qs, many=True)
            return Response(serializer.data)

        if project.owner_id == request.user.id:
            raise PermissionDenied("You cannot bid on your own project.")

        if not getattr(project, "is_job_posting", False):
            raise ValidationError("This project is not open for bidding.")

        if Bid.objects.filter(project=project, status=Bid.STATUS_ACCEPTED).exists():
            raise ValidationError("This job posting is closed to new bids.")

        existing = Bid.objects.filter(project=project, contractor=request.user).first()
        if existing:
            raise ValidationError("You already submitted a bid for this project.")

        data = request.data.copy()
        data["project"] = project.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(contractor=request.user)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        bid = self.get_object()

        if bid.project.owner_id != request.user.id:
            raise PermissionDenied("Only the project owner can accept a bid.")

        if bid.status != Bid.STATUS_PENDING:
            raise ValidationError("Only pending bids can be accepted.")

        with transaction.atomic():
            bid.status = Bid.STATUS_ACCEPTED
            bid.owner_response_note = request.data.get("owner_response_note", "") or ""
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

            acceptance_note = (bid.owner_response_note or "").strip()
            text = f"Your bid for \"{bid.project.title}\" was accepted."
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

        if bid.status != Bid.STATUS_PENDING:
            raise ValidationError("Only pending bids can be declined.")

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

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        bid = self.get_object()

        if bid.project.owner_id != request.user.id:
            raise PermissionDenied("Only the project owner can reopen a bid.")

        if bid.status != Bid.STATUS_DECLINED:
            raise ValidationError("Only declined bids can be reopened.")

        note = request.data.get("owner_response_note", "") or request.data.get("reopen_note", "") or ""
        if not str(note).strip():
            raise ValidationError({"owner_response_note": "Reopen note is required."})

        if Bid.objects.filter(project=bid.project, status=Bid.STATUS_ACCEPTED).exclude(pk=bid.pk).exists():
            raise ValidationError("This job posting already has an accepted bid and cannot be reopened.")

        bid.status = Bid.STATUS_REVISION_REQUESTED
        bid.owner_response_note = note
        bid.save(update_fields=["status", "owner_response_note"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        bid = self.get_object()

        if bid.contractor_id != request.user.id:
            raise PermissionDenied("Only the contractor can withdraw this bid.")

        if bid.status not in (Bid.STATUS_PENDING, Bid.STATUS_REVISION_REQUESTED):
            raise ValidationError("Only active bids can be withdrawn.")

        bid.status = Bid.STATUS_WITHDRAWN
        bid.save(update_fields=["status"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.db import transaction

from portfolio.models import Project
from .models import Bid
from .serializers import BidSerializer


class BidViewSet(viewsets.ModelViewSet):
    queryset = Bid.objects.all().select_related("project", "contractor")
    serializer_class = BidSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Bid.objects.filter(
            contractor=user
        ).select_related("project", "contractor")

    def perform_create(self, serializer):
        project = serializer.validated_data["project"]

        if project.owner == self.request.user:
            raise PermissionDenied("You cannot bid on your own project.")

        if not getattr(project, "is_job_posting", False):
            raise ValidationError("This project is not open for bidding.")

        serializer.save(contractor=self.request.user)

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
            bid.save(update_fields=["status"])

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

        bid.status = Bid.STATUS_DECLINED
        bid.save(update_fields=["status"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        bid = self.get_object()

        if bid.contractor_id != request.user.id:
            raise PermissionDenied("Only the contractor can withdraw this bid.")

        if bid.status == Bid.STATUS_ACCEPTED:
            raise ValidationError("Accepted bids cannot be withdrawn.")

        bid.status = Bid.STATUS_WITHDRAWN
        bid.save(update_fields=["status"])

        serializer = self.get_serializer(bid)
        return Response(serializer.data)
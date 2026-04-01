from django.conf import settings
from django.db import models
from django.utils import timezone

from portfolio.models import Project


class Bid(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_WITHDRAWN = "withdrawn"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_WITHDRAWN, "Withdrawn"),
    ]

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="bids",
    )
    contractor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submitted_bids",
    )

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    message = models.TextField(blank=True, default="")

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )

    owner_response_note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "contractor"],
                name="unique_bid_per_project_per_contractor",
            )
        ]

    def __str__(self):
        return f"Bid {self.id} for project {self.project_id}"
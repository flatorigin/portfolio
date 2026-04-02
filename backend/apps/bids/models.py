from django.conf import settings
from django.db import models
from django.utils import timezone

from portfolio.models import Project


class Bid(models.Model):
    STATUS_PENDING = "pending"
    STATUS_REVISION_REQUESTED = "revision_requested"
    STATUS_ACCEPTED = "accepted"
    STATUS_DECLINED = "declined"
    STATUS_WITHDRAWN = "withdrawn"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_REVISION_REQUESTED, "Revision Requested"),
        (STATUS_ACCEPTED, "Accepted"),
        (STATUS_DECLINED, "Declined"),
        (STATUS_WITHDRAWN, "Withdrawn"),
    ]

    PRICE_TYPE_FIXED = "fixed"
    PRICE_TYPE_RANGE = "range"
    PRICE_TYPE_CHOICES = [
        (PRICE_TYPE_FIXED, "Fixed price"),
        (PRICE_TYPE_RANGE, "Estimate range"),
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

    price_type = models.CharField(
        max_length=20,
        choices=PRICE_TYPE_CHOICES,
        default=PRICE_TYPE_FIXED,
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    amount_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    amount_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    timeline_text = models.CharField(max_length=255, blank=True, default="")
    proposal_text = models.TextField(blank=True, default="")
    included_text = models.TextField(blank=True, default="")
    excluded_text = models.TextField(blank=True, default="")
    payment_terms = models.TextField(blank=True, default="")
    valid_until = models.DateField(null=True, blank=True)
    attachment = models.FileField(upload_to="bid_attachments/", blank=True, null=True)
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

from decimal import Decimal, InvalidOperation

from rest_framework import serializers

from .models import Bid


class BidSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source="contractor.username", read_only=True)
    contractor_username = serializers.CharField(source="contractor.username", read_only=True)
    project_title = serializers.CharField(source="project.title", read_only=True)
    project_owner_username = serializers.CharField(source="project.owner.username", read_only=True)
    project_created_at = serializers.DateTimeField(source="project.created_at", read_only=True)
    accepted_by_username = serializers.CharField(source="accepted_by.username", read_only=True)
    attachment_url = serializers.SerializerMethodField()
    display_amount = serializers.SerializerMethodField()
    latest_version = serializers.SerializerMethodField()

    class Meta:
        model = Bid
        fields = [
            "id",
            "project",
            "project_title",
            "project_owner_username",
            "project_created_at",
            "contractor",
            "contractor_name",
            "contractor_username",
            "price_type",
            "amount",
            "amount_min",
            "amount_max",
            "timeline_text",
            "proposal_text",
            "included_text",
            "excluded_text",
            "payment_terms",
            "valid_until",
            "attachment",
            "attachment_url",
            "message",
            "display_amount",
            "latest_version",
            "status",
            "accepted_at",
            "accepted_by",
            "accepted_by_username",
            "owner_response_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "contractor",
            "status",
            "accepted_at",
            "accepted_by",
            "created_at",
            "updated_at",
        ]

    def get_attachment_url(self, obj):
        request = self.context.get("request")
        if obj.attachment and hasattr(obj.attachment, "url"):
            url = obj.attachment.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_display_amount(self, obj):
        if obj.price_type == Bid.PRICE_TYPE_RANGE:
            if obj.amount_min is not None and obj.amount_max is not None:
                return f"${obj.amount_min} - ${obj.amount_max}"
            return ""
        if obj.amount is not None:
            return f"${obj.amount}"
        return ""

    def get_latest_version(self, obj):
        return {
            "status": obj.status,
            "price_type": obj.price_type,
            "amount": obj.amount,
            "amount_min": obj.amount_min,
            "amount_max": obj.amount_max,
            "timeline_text": obj.timeline_text,
            "proposal_text": obj.proposal_text or obj.message,
            "included_text": obj.included_text,
            "excluded_text": obj.excluded_text,
            "payment_terms": obj.payment_terms,
            "valid_until": obj.valid_until,
            "attachment_url": self.get_attachment_url(obj),
            "accepted_at": obj.accepted_at,
            "accepted_by_username": getattr(obj.accepted_by, "username", "") if obj.accepted_by_id else "",
            "created_at": obj.updated_at or obj.created_at,
        }

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance and "project" in attrs and attrs["project"].id != instance.project_id:
            raise serializers.ValidationError({"project": "Project cannot be changed."})

        price_type = attrs.get("price_type", getattr(instance, "price_type", Bid.PRICE_TYPE_FIXED))
        amount = attrs.get("amount", getattr(instance, "amount", None))
        amount_min = attrs.get("amount_min", getattr(instance, "amount_min", None))
        amount_max = attrs.get("amount_max", getattr(instance, "amount_max", None))
        message_text = attrs.get("message", getattr(instance, "message", ""))
        proposal_text = attrs.get("proposal_text", message_text or getattr(instance, "proposal_text", ""))

        if price_type == Bid.PRICE_TYPE_FIXED:
            if amount in (None, ""):
                raise serializers.ValidationError({"amount": "Bid amount is required for fixed price bids."})
            attrs["amount_min"] = None
            attrs["amount_max"] = None
        elif price_type == Bid.PRICE_TYPE_RANGE:
            if amount_min in (None, "") or amount_max in (None, ""):
                raise serializers.ValidationError(
                    {"amount_min": "Minimum and maximum amounts are required for estimate range bids."}
                )
            try:
                min_value = Decimal(str(amount_min))
                max_value = Decimal(str(amount_max))
            except (InvalidOperation, TypeError):
                raise serializers.ValidationError({"amount_min": "Enter valid range amounts."})
            if min_value > max_value:
                raise serializers.ValidationError(
                    {"amount_max": "Maximum amount must be greater than or equal to minimum amount."}
                )
            attrs["amount"] = None
        else:
            raise serializers.ValidationError({"price_type": "Invalid price type."})

        if not str(proposal_text or "").strip():
            raise serializers.ValidationError({"proposal_text": "Proposal is required."})

        attrs["proposal_text"] = proposal_text
        attrs["message"] = proposal_text
        return attrs

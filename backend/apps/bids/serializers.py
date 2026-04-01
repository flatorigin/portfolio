from rest_framework import serializers
from .models import Bid


class BidSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(source="contractor.username", read_only=True)

    class Meta:
        model = Bid
        fields = [
            "id",
            "project",
            "contractor",
            "contractor_name",
            "amount",
            "message",
            "status",
            "owner_response_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "contractor",
            "status",
            "owner_response_note",
            "created_at",
            "updated_at",
        ]
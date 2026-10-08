from django.db import transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from .models import IntroVideoSession


class VideoSnapshotSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    viewer_id = serializers.UUIDField()
    source = serializers.ChoiceField(choices=["homepage", "watch"])
    watch_seconds = serializers.FloatField(min_value=0, max_value=86400)
    completed = serializers.BooleanField()
    replays = serializers.IntegerField(min_value=0, max_value=1000)
    share_actions = serializers.IntegerField(min_value=0, max_value=1000)
    copy_actions = serializers.IntegerField(min_value=0, max_value=1000)
    email_actions = serializers.IntegerField(min_value=0, max_value=1000)

    def validate_watch_seconds(self, value):
        import math
        if not math.isfinite(value):
            raise serializers.ValidationError("Watch time must be finite.")
        return value


class VideoAnalyticsThrottle(AnonRateThrottle):
    scope = "intro_video"
    rate = "600/hour"


class IntroVideoAnalyticsView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [VideoAnalyticsThrottle]

    def post(self, request):
        serializer = VideoSnapshotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        with transaction.atomic():
            row, _ = IntroVideoSession.objects.get_or_create(
                session_id=values["session_id"],
                defaults={"viewer_id": values["viewer_id"], "source": values["source"]},
            )
            row = IntroVideoSession.objects.select_for_update().get(pk=row.pk)
            if row.viewer_id != values["viewer_id"]:
                return Response(status=400)
            for name in ["watch_seconds", "replays", "share_actions", "copy_actions", "email_actions"]:
                setattr(row, name, max(getattr(row, name), values[name]))
            row.completed = row.completed or (values["completed"] and values["watch_seconds"] >= 46)
            row.save()
        return Response(status=204)

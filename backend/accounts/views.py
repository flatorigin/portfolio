# backend/accounts/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth import get_user_model
from .models import Profile
from .serializers import MeSerializer

User = get_user_model()


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_profile(self, user):
        # Ensure a Profile exists for this user
        profile, _ = Profile.objects.get_or_create(user=user)
        return profile

    def get(self, request, *args, **kwargs):
        prof = self.get_profile(request.user)
        ser = MeSerializer(prof, context={"request": request})
        return Response(ser.data)

    def patch(self, request, *args, **kwargs):
        prof = self.get_profile(request.user)
        ser = MeSerializer(
            prof,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

# backend/accounts/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.contrib.auth import get_user_model
from .models import Profile
from .serializers import MeSerializer, ProfileSerializer
from django.shortcuts import get_object_or_404

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

class PublicProfileView(APIView):
    """
    Read-only public profile by username.
    GET /api/profiles/<username>/
    """
    permission_classes = [AllowAny]

    def get(self, request, username, *args, **kwargs):
        user = get_object_or_404(User, username=username)
        profile, _ = Profile.objects.get_or_create(user=user)
        serializer = ProfileSerializer(profile, context={"request": request})
        return Response(serializer.data)
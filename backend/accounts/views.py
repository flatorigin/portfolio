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
    """
    Authenticated user's own profile.
    GET  /api/users/me/
    PATCH /api/users/me/   (multipart for logo/banner + text fields)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_profile(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        return profile

    def get(self, request, *args, **kwargs):
        profile = self._get_profile(request)
        serializer = ProfileSerializer(profile, context={"request": request})
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):
        profile = self._get_profile(request)

        # NOTE: request.data already merges form fields + files
        serializer = ProfileSerializer(
            profile,
            data=request.data,
            partial=True,                 # <-- allow partial updates
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


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
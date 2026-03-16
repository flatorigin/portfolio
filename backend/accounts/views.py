# backend/accounts/views.py
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile, ProfileLike
from .serializers import ProfileSerializer, LikedProfileCardSerializer

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

        serializer = ProfileSerializer(
            profile,
            data=request.data,
            partial=True,
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


class ProfileLikeView(APIView):
    """
    GET    /api/profiles/<username>/like/   -> { liked: bool, like_count: int }
    POST   /api/profiles/<username>/like/   -> like
    DELETE /api/profiles/<username>/like/   -> unlike
    """
    permission_classes = [IsAuthenticated]

    def get_target(self, username: str):
        return get_object_or_404(User, username=username)

    def get(self, request, username):
        target = self.get_target(username)
        liked = ProfileLike.objects.filter(liker=request.user, liked_user=target).exists()
        count = ProfileLike.objects.filter(liked_user=target).count()
        return Response({"liked": liked, "like_count": count}, status=status.HTTP_200_OK)

    def post(self, request, username):
        target = self.get_target(username)

        if target.id == request.user.id:
            return Response(
                {"detail": "You cannot like your own profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ProfileLike.objects.get_or_create(liker=request.user, liked_user=target)
        count = ProfileLike.objects.filter(liked_user=target).count()
        return Response({"liked": True, "like_count": count}, status=status.HTTP_200_OK)

    def delete(self, request, username):
        target = self.get_target(username)
        ProfileLike.objects.filter(liker=request.user, liked_user=target).delete()
        count = ProfileLike.objects.filter(liked_user=target).count()
        return Response({"liked": False, "like_count": count}, status=status.HTTP_200_OK)


class LikedProfilesView(APIView):
    """
    GET /api/profiles/liked/
    Returns profiles the current user has liked (for Dashboard "Saved Profiles")
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        liked_user_ids = (
            ProfileLike.objects
            .filter(liker=request.user)
            .values_list("liked_user_id", flat=True)
        )

        qs = (
            Profile.objects
            .filter(user_id__in=list(liked_user_ids))
            .select_related("user")
        )

        ser = LikedProfileCardSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)
# backend/accounts/views.py
import logging
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Q
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect

from djoser import signals
from djoser.serializers import ActivationSerializer
from djoser.views import UserViewSet as DjoserUserViewSet
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile, ProfileLike, ProfileSave
from .serializers import (
    ProfileSerializer,
    PublicUserProfileSerializer,
    LikedProfileCardSerializer,
    SavedProfileCardSerializer,
    ContractorSearchResultSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)
PROJECT_SEARCH_STOPWORDS = {
    "and",
    "the",
    "job",
    "post",
    "work",
    "need",
    "needs",
    "project",
    "repair",
    "replace",
    "install",
    "build",
    "fix",
    "new",
    "old",
}


class RegistrationIncomplete(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = (
        "Registration could not be completed because the activation email "
        "could not be sent. No account was created. Please try again."
    )
    default_code = "registration_incomplete"


class SafeUserCreateViewSet(DjoserUserViewSet):
    """
    Djoser creates the user before sending the activation email. If the email
    provider fails, wrap creation in a transaction so retrying does not hit
    "username already exists" from a half-created inactive user.
    """

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            with transaction.atomic():
                self.perform_create(serializer)
        except Exception:
            logger.exception("Registration failed after validation; rolled back user creation.")
            raise RegistrationIncomplete()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ActivationRedirectView(APIView):
    """
    Email links are GET requests. Activate directly here, then send the user to
    the login page so production does not depend on the React route loading first.
    """
    permission_classes = [AllowAny]
    token_generator = default_token_generator

    def get(self, request, uid, token, *args, **kwargs):
        serializer = ActivationSerializer(
            data={"uid": uid, "token": token},
            context={"request": request, "view": self},
        )

        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.user
            user.is_active = True
            user.save(update_fields=["is_active"])
            signals.user_activated.send(
                sender=self.__class__,
                user=user,
                request=request,
            )
            return redirect("/login?activated=1")
        except Exception:
            logger.exception("Activation link failed.")
            return redirect("/login?activation_error=1")


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

        can_view_frozen = (
            request.user.is_authenticated
            and (request.user.is_staff or request.user.id == user.id)
        )
        if profile.is_frozen and not can_view_frozen:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PublicUserProfileSerializer(profile, context={"request": request})
        return Response(serializer.data)


class ContractorSearchView(APIView):
    """
    Search active contractor profiles for private job invites.
    GET /api/profiles/contractors/search/?q=term
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        query = (request.query_params.get("q") or "").strip()
        project_query = (request.query_params.get("project_q") or "").strip()
        qs = (
            Profile.objects
            .filter(
                profile_type=Profile.ProfileType.CONTRACTOR,
                is_frozen=False,
                user__is_active=True,
            )
            .exclude(user=request.user)
            .select_related("user")
            .order_by("display_name", "user__username")
        )

        if query:
            qs = qs.filter(
                Q(user__username__icontains=query)
                | Q(display_name__icontains=query)
                | Q(service_location__icontains=query)
                | Q(bio__icontains=query)
                | Q(hero_headline__icontains=query)
            )

        if project_query:
            terms = [
                term.lower()
                for term in re.split(r"[\s,;/|]+", project_query)
                if len(term) >= 3 and term.lower() not in PROJECT_SEARCH_STOPWORDS
            ]
            project_filter = Q()
            for term in terms[:8]:
                project_filter |= (
                    Q(display_name__icontains=term)
                    | Q(service_location__icontains=term)
                    | Q(bio__icontains=term)
                    | Q(hero_headline__icontains=term)
                )
            if project_filter:
                qs = qs.filter(project_filter)

        serializer = ContractorSearchResultSerializer(
            qs[:20],
            many=True,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


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
            .filter(is_frozen=False)
            .select_related("user")
        )

        ser = LikedProfileCardSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)


class ProfileSaveView(APIView):
    permission_classes = [IsAuthenticated]

    def get_target(self, username: str):
        return get_object_or_404(User, username=username)

    def get(self, request, username):
        target = self.get_target(username)
        saved = ProfileSave.objects.filter(saver=request.user, saved_user=target).exists()
        return Response({"saved": saved}, status=status.HTTP_200_OK)

    def post(self, request, username):
        target = self.get_target(username)

        if target.id == request.user.id:
            return Response(
                {"detail": "You cannot save your own profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ProfileSave.objects.get_or_create(saver=request.user, saved_user=target)
        return Response({"saved": True}, status=status.HTTP_200_OK)

    def delete(self, request, username):
        target = self.get_target(username)
        ProfileSave.objects.filter(saver=request.user, saved_user=target).delete()
        return Response({"saved": False}, status=status.HTTP_200_OK)


class SavedProfilesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        saved_user_ids = (
            ProfileSave.objects
            .filter(saver=request.user)
            .values_list("saved_user_id", flat=True)
        )

        qs = (
            Profile.objects
            .filter(user_id__in=list(saved_user_ids))
            .filter(is_frozen=False)
            .select_related("user")
        )

        ser = SavedProfileCardSerializer(qs, many=True, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)

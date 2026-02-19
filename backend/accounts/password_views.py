# backend/accounts/password_views.py

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .password_serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)


@method_decorator(csrf_exempt, name="dispatch")
class PasswordResetRequestView(APIView):
    authentication_classes = []  # public
    permission_classes = []      # public

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "If that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name="dispatch")
class PasswordResetConfirmView(APIView):
    authentication_classes = []  # public
    permission_classes = []      # public

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Password has been reset."},
            status=status.HTTP_200_OK,
        )
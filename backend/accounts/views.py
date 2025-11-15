# accounts/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from .models import Profile
from .serializers import MeSerializer

User = get_user_model()

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_profile(self, user):
        # Ensure a Profile exists
        return Profile.objects.get_or_create(user=user)[0]

    def get(self, request):
        prof = self.get_profile(request.user)
        return Response(MeSerializer(prof).data)

    def patch(self, request):
        prof = self.get_profile(request.user)
        ser = MeSerializer(prof, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        return Response(ser.save())

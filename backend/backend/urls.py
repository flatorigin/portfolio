# file: backend/urls.py  (top-level, for clarity)
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import View
from django.http import FileResponse
from django.http import HttpResponse
import os

class ReactAppView(View):
    def get(self, request):
        return HttpResponse(f"BASE_DIR = {settings.BASE_DIR}")

urlpatterns = [
    re_path(r"^(?!api|admin).*", TemplateView.as_view(template_name="index.html")),    path("admin/", admin.site.urls),
    path("admin/", admin.site.urls),
    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path("api/", include("accounts.urls")),
    path("api/", include("portfolio.urls")),     
]

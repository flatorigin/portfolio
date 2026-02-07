# file: backend/urls.py  (top-level, for clarity)
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf.urls.static import static
from django.views.generic import View, TemplateView
from django.http import FileResponse, HttpResponse
from django.conf import settings
import os

class ReactAppView(View):
    def get(self, request):
        index_path = os.path.join(
            settings.BASE_DIR.parent,
            "frontend",
            "dist",
            "index.html"
        )

        if not os.path.exists(index_path):
            return HttpResponse(f"React build NOT found at: {index_path}")

        return FileResponse(open(index_path, "rb"))


urlpatterns = [
    re_path(r"^(?!api|admin).*", TemplateView.as_view(template_name="index.html")),    path("admin/", admin.site.urls),
    path("admin/", admin.site.urls),
    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path("api/", include("accounts.urls")),
    path("api/", include("portfolio.urls")),     
]

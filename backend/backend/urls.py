# file: backend/urls.py  (top-level, for clarity)
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf.urls.static import static
from django.views.generic import View, TemplateView
from django.http import FileResponse, HttpResponse
from django.conf import settings
from django.contrib.staticfiles.views import serve as serve_static
import os

class ReactAppView(View):
    def get(self, request):
        index_path = os.path.join(
            settings.BASE_DIR.parent,
            "frontend",
            "dist",
            "index.html"
        )
        return FileResponse(open(index_path, "rb"))


urlpatterns = [
    # Serve Vite assets
    re_path(r"^assets/(?P<path>.*)$", serve_static),

    # React fallback
    re_path(r"^.*$", ReactAppView.as_view()),
    path("admin/", admin.site.urls),
    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path("api/", include("accounts.urls")),
    path("api/", include("portfolio.urls")),     
]

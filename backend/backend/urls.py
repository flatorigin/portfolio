from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import View
from django.http import FileResponse
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

    # ✅ Django routes FIRST (safe)
    path("admin/", admin.site.urls),

    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path("api/", include("accounts.urls")),
    path("api/", include("portfolio.urls")),

    # ✅ React static assets SECOND
    re_path(r"^assets/(?P<path>.*)$", serve_static),

    # ✅ React fallback LAST
    re_path(r"^.*$", ReactAppView.as_view()),
]
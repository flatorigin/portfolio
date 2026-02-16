# backend/backend/urls.py

from django.contrib import admin
from django.urls import path, include, re_path
from django.views import View
from django.conf.urls.static import static
from django.http import FileResponse
from django.conf import settings
from django.views.static import serve  # ✅ ADD
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
    path("admin/", admin.site.urls),

    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path("api/", include("accounts.urls")),
    path("api/", include("portfolio.urls")),
]

# Keep your existing dev media handling
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# ✅ ADD: production media serving (so /media/... doesn't hit the SPA fallback)
# Must be BEFORE the catch-all.
if not settings.DEBUG:
    media_url = settings.MEDIA_URL.lstrip("/")  # e.g. "media/"
    urlpatterns += [
        re_path(
            rf"^{media_url}(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]

urlpatterns += [
    re_path(r"^.*$", ReactAppView.as_view()),
]
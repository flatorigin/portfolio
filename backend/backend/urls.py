from django.contrib import admin
from django.urls import path, include, re_path
from django.views import View
from django.http import FileResponse
from django.conf import settings
from django.contrib.staticfiles.views import serve as serve_static
import os


FRONTEND_DIST = os.path.join(settings.BASE_DIR.parent, "frontend", "dist")


class ReactAppView(View):
    def get(self, request):
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(open(index_path, "rb"))


def serve_react_asset(request, path):
    file_path = os.path.join(FRONTEND_DIST, path)

    if os.path.exists(file_path):
        return FileResponse(open(file_path, "rb"))

    return ReactAppView().get(request)


urlpatterns = [
    # Admin + API first
    path("admin/", admin.site.urls),
    path("api/auth/", include("djoser.urls")),
    path("api/auth/", include("djoser.urls.jwt")),
    path("api/", include("accounts.urls")),
    path("api/", include("portfolio.urls")),

    # Serve Vite assets
    re_path(r"^static/(?P<path>.*)$", serve_static),

    # React fallback LAST
    re_path(r"^.*$", ReactAppView.as_view()),
]
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import View
from django.http import FileResponse
from django.conf import settings
import os


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
]


class ReactAppView(View):
    def get(self, request):
        index_path = os.path.join(settings.BASE_DIR, "../frontend/dist/index.html")
        return FileResponse(open(index_path, "rb"))


urlpatterns += [
    re_path(r"^.*$", ReactAppView.as_view()),
]

# # file: backend/urls.py  (top-level, for clarity)
# from django.contrib import admin
# from django.urls import path, include, re_path
# from django.conf import settings
# from django.conf.urls.static import static
# from django.views.generic import View
# from django.http import FileResponse
# import os

# class ReactAppView(View):
#     def get(self, request):
#         index_path = os.path.join(settings.BASE_DIR, "../frontend/dist/index.html")
#         return FileResponse(open(index_path, "rb"))

# urlpatterns = [
#     re_path(r"^.*$", ReactAppView.as_view()),
#     path("admin/", admin.site.urls),
#     path("api/auth/", include("djoser.urls")),
#     path("api/auth/", include("djoser.urls.jwt")),
#     path("api/", include("accounts.urls")),
#     path("api/", include("portfolio.urls")),
# ]

# if settings.DEBUG:
#     urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
#     # urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

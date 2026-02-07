from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import View
from django.http import FileResponse
from django.conf import settings
import os
from django.http import HttpResponse

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
]


class ReactAppView(View):
    def get(self, request):
        return HttpResponse(f"BASE_DIR = {settings.BASE_DIR}")

urlpatterns += [
    re_path(r"^.*$", ReactAppView.as_view()),
]
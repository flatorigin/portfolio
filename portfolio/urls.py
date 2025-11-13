from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet, ProjectImageViewSet

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("project-images", ProjectImageViewSet, basename="project-image")
urlpatterns = router.urls

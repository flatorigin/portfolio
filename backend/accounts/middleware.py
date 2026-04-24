from django.contrib.contenttypes.models import ContentType
from django.http import HttpResponseForbidden

from .models import AdminAuditLog, user_can_access_admin


class AdminAccessAuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/admin") and getattr(request, "user", None) and request.user.is_authenticated:
            if user_can_access_admin(request.user):
                if not request.session.get("admin_access_logged"):
                    AdminAuditLog.objects.create(
                        actor=request.user,
                        event_type=AdminAuditLog.EventType.ADMIN_LOGIN,
                        target_user=request.user,
                        target_content_type=ContentType.objects.get_for_model(request.user.__class__),
                        target_object_id=request.user.pk,
                        summary=f"Admin login for {request.user.username}",
                        metadata={"path": request.path},
                    )
                    request.session["admin_access_logged"] = True
            elif request.user.is_staff:
                AdminAuditLog.objects.create(
                    actor=request.user,
                    event_type=AdminAuditLog.EventType.ADMIN_ACCESS_DENIED,
                    target_user=request.user,
                    target_content_type=ContentType.objects.get_for_model(request.user.__class__),
                    target_object_id=request.user.pk,
                    summary=f"Denied admin access for {request.user.username}",
                    metadata={"path": request.path},
                )
                return HttpResponseForbidden("Admin access is restricted for this account.")

        return self.get_response(request)

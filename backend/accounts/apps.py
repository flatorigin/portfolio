from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        from django.contrib.auth import get_user_model
        from django.db.models.signals import post_save

        from .models import Profile

        User = get_user_model()

        def ensure_profile(sender, instance, created, **kwargs):
            if created:
                Profile.objects.get_or_create(user=instance)

        post_save.connect(
            ensure_profile,
            sender=User,
            dispatch_uid="accounts.ensure_profile",
        )

        from django.utils import timezone
        from djoser.signals import user_activated

        def mark_email_verified(sender, user, **kwargs):
            profile, _ = Profile.objects.get_or_create(user=user)
            if not profile.email_verified_at:
                profile.email_verified_at = timezone.now()
                profile.save(update_fields=["email_verified_at"])

        user_activated.connect(
            mark_email_verified,
            dispatch_uid="accounts.mark_email_verified",
            weak=False,
        )

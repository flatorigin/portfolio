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

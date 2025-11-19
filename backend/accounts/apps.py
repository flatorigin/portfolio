# file: accounts/apps.py  ✅ FIXED
from django.apps import AppConfig

class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    # Optional: create Profile on new User creation
    def ready(self):
        try:
            from django.db.models.signals import post_save
            from django.contrib.auth import get_user_model
            from .models import Profile

            User = get_user_model()

            def ensure_profile(sender, instance, created, **kwargs):
                if created:
                    Profile.objects.get_or_create(user=instance)

            post_save.connect(ensure_profile, sender=User)
        except Exception:
            # Why: avoid breaking startup if migrations not applied yet
            pass

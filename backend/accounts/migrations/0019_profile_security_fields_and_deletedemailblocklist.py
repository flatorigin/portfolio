from django.db import migrations, models
from django.utils import timezone


def mark_existing_active_users_verified(apps, schema_editor):
    Profile = apps.get_model("accounts", "Profile")
    Profile.objects.filter(
        user__is_active=True,
        email_verified_at__isnull=True,
    ).update(email_verified_at=timezone.now())


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0018_profile_ai_daily_limit_override"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="deactivated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="profile",
            name="email_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="profile",
            name="is_deactivated",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="DeletedEmailBlocklist",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("reason", models.CharField(blank=True, default="deleted_account", max_length=120)),
                ("created_at", models.DateTimeField(db_index=True, default=timezone.now)),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.RunPython(mark_existing_active_users_verified, migrations.RunPython.noop),
    ]

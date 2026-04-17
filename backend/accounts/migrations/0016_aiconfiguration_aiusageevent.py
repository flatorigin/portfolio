from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0015_profile_public_profile_enabled_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AIConfiguration",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("enabled", models.BooleanField(default=False)),
                ("project_helper_enabled", models.BooleanField(default=True)),
                ("bid_helper_enabled", models.BooleanField(default=True)),
                ("profile_helper_enabled", models.BooleanField(default=True)),
                ("daily_limit_per_user", models.PositiveIntegerField(default=10)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="ai_config_updates", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "AI configuration",
                "verbose_name_plural": "AI configuration",
            },
        ),
        migrations.CreateModel(
            name="AIUsageEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("feature", models.CharField(choices=[("project_summary", "Project summary"), ("project_checklist", "Project checklist"), ("bid_proposal", "Bid proposal"), ("profile_headline", "Profile headline"), ("profile_blurb", "Profile blurb"), ("profile_bio", "Profile bio")], max_length=40)),
                ("model_name", models.CharField(blank=True, default="", max_length=64)),
                ("status", models.CharField(choices=[("success", "Success"), ("rejected", "Rejected"), ("error", "Error")], default="success", max_length=20)),
                ("prompt_chars", models.PositiveIntegerField(default=0)),
                ("response_chars", models.PositiveIntegerField(default=0)),
                ("request_day", models.DateField(db_index=True, default=django.utils.timezone.localdate)),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="ai_usage_events", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
    ]

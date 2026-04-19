from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import portfolio.models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("portfolio", "0021_privatemessage_context_project"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProjectPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, default="Untitled issue", max_length=255)),
                ("issue_summary", models.TextField(blank=True, default="")),
                ("house_location", models.CharField(blank=True, default="", max_length=140)),
                ("priority", models.CharField(blank=True, choices=[("low", "Low"), ("medium", "Medium"), ("high", "High")], default="medium", max_length=20)),
                ("budget_min", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("budget_max", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("notes", models.TextField(blank=True, default="")),
                ("status", models.CharField(choices=[("planning", "Planning"), ("ready_to_draft", "Ready to draft"), ("converted", "Converted"), ("archived", "Archived")], default="planning", max_length=20)),
                ("visibility", models.CharField(default="private", max_length=20)),
                ("contractor_types", models.JSONField(blank=True, default=list)),
                ("links", models.JSONField(blank=True, default=list)),
                ("options", models.JSONField(blank=True, default=list)),
                ("selected_option_key", models.CharField(blank=True, default="", max_length=80)),
                ("ai_generated_issue_summary", models.TextField(blank=True, default="")),
                ("ai_suggested_contractor_types", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("converted_job_post", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="source_project_plans", to="portfolio.project")),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="project_plans", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-updated_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="ProjectPlanImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to=portfolio.models.project_plan_image_upload_path)),
                ("caption", models.CharField(blank=True, default="", max_length=255)),
                ("order", models.PositiveIntegerField(default=0)),
                ("is_cover", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("project_plan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="images", to="portfolio.projectplan")),
            ],
            options={
                "ordering": ["order", "id"],
            },
        ),
    ]

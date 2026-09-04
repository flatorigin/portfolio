from django.db import migrations, models
from django.utils import timezone


def complete_demo_for_existing_contractors(apps, schema_editor):
    Profile = apps.get_model("accounts", "Profile")
    Project = apps.get_model("portfolio", "Project")

    owner_ids = Project.objects.filter(is_job_posting=False).values_list(
        "owner_id", flat=True
    )
    Profile.objects.filter(
        user_id__in=owner_ids,
        profile_type="contractor",
        contractor_dashboard_demo_completed_at__isnull=True,
    ).update(contractor_dashboard_demo_completed_at=timezone.now())


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0033_ai_usage_cost_tracking"),
        ("portfolio", "0032_project_view_count"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="contractor_dashboard_demo_completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            complete_demo_for_existing_contractors,
            migrations.RunPython.noop,
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0034_profile_contractor_dashboard_demo"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="contractor_job_reviewed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
